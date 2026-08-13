import type { Chunk } from "@/server/domain/entities";
import type { ChunkRepository } from "@/server/ports/repositories";
import type { TTSProvider } from "@/server/ports/tts";
import { createChunkCacheKey } from "@/server/tts/chunkCache";
import type { Limiter } from "@/server/tts/concurrency";

export type RetryChunkDeps = {
  chunks: ChunkRepository;
  tts: TTSProvider;
  ttsLimiter?: Limiter;
};

export type RetryChunkInput = {
  chunkId: string;
  text: string;
  voice: string;
  rate: string;
  pitch: string;
};

export class RetryChunkError extends Error {
  constructor(
    readonly code:
      | "CHUNK_NOT_FOUND"
      | "CHUNK_NOT_FAILED"
      | "CHUNK_RETRY_KEY_MISMATCH"
      | "CHUNK_RETRY_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "RetryChunkError";
  }
}

export async function retryChunk(
  deps: RetryChunkDeps,
  input: RetryChunkInput,
): Promise<Chunk> {
  const chunk = await deps.chunks.findById(input.chunkId);
  if (!chunk) {
    throw new RetryChunkError("CHUNK_NOT_FOUND", "Chunk not found");
  }

  if (chunk.status !== "failed") {
    throw new RetryChunkError(
      "CHUNK_NOT_FAILED",
      "Only failed chunks can be retried",
    );
  }

  const { cacheKey } = createChunkCacheKey({
    text: input.text,
    voice: input.voice,
    rate: input.rate,
    pitch: input.pitch,
  });

  if (cacheKey !== chunk.textHash) {
    throw new RetryChunkError(
      "CHUNK_RETRY_KEY_MISMATCH",
      "Retry text or voice parameters do not match the chunk",
    );
  }

  const nextRetryCount = chunk.retryCount + 1;
  await deps.chunks.updateById(chunk.id, {
    status: "processing",
    retryCount: nextRetryCount,
    errorMessage: null,
  });

  let audio: Awaited<ReturnType<TTSProvider["synthesize"]>>;
  try {
    const synthesize = () =>
      deps.tts.synthesize({
        text: input.text,
        voice: input.voice,
        rate: input.rate,
        pitch: input.pitch,
        fileName: `${chunk.partId}-${chunk.index}-retry-${nextRetryCount}.mp3`,
      });
    audio = deps.ttsLimiter
      ? await deps.ttsLimiter(synthesize)
      : await synthesize();
  } catch (error) {
    const reason = toErrorMessage(error);
    const failed = await deps.chunks.updateById(chunk.id, {
      status: "failed",
      errorMessage: reason,
    });

    throw new RetryChunkError(
      "CHUNK_RETRY_FAILED",
      failed?.errorMessage ?? reason,
    );
  }

  const completed = await deps.chunks.updateById(chunk.id, {
    audioPath: audio.audioPath,
    status: "completed",
    errorMessage: null,
  });

  if (!completed) {
    throw new RetryChunkError("CHUNK_NOT_FOUND", "Chunk not found");
  }

  return completed;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Chunk retry failed";
}
