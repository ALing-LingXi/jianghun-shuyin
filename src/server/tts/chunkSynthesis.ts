import type { Chunk } from "@/server/domain/entities";
import type { ChunkRepository } from "@/server/ports/repositories";
import type { TTSProvider } from "@/server/ports/tts";
import { buildChunks } from "@/server/tts/buildChunks";
import { createChunkCacheKey } from "@/server/tts/chunkCache";

export type SynthesizePartChunksDeps = {
  chunks: ChunkRepository;
  tts: TTSProvider;
};

export type SynthesizePartChunksInput = {
  partId: string;
  text: string;
  voice: string;
  rate: string;
  pitch: string;
  maxCharacters?: number;
};

export type SynthesizePartChunksResult = {
  chunks: Chunk[];
  cacheHits: number;
  failedCount: number;
};

const MAX_TTS_ATTEMPTS = 3;

export async function synthesizePartChunks(
  deps: SynthesizePartChunksDeps,
  input: SynthesizePartChunksInput,
): Promise<SynthesizePartChunksResult> {
  const plannedChunks = buildChunks({
    text: input.text,
    maxCharacters: input.maxCharacters,
  });
  const createdChunks: Chunk[] = [];
  let cacheHits = 0;
  let failedCount = 0;

  for (const plannedChunk of plannedChunks) {
    const { cacheKey } = createChunkCacheKey({
      text: plannedChunk.text,
      voice: input.voice,
      rate: input.rate,
      pitch: input.pitch,
    });
    const cached = await deps.chunks.findCompletedByTextHash(cacheKey);

    if (cached?.audioPath) {
      cacheHits += 1;
      createdChunks.push(
        await deps.chunks.create({
          partId: input.partId,
          index: plannedChunk.index,
          textHash: cacheKey,
          audioPath: cached.audioPath,
          status: "completed",
        }),
      );
      continue;
    }

    const chunk = await deps.chunks.create({
      partId: input.partId,
      index: plannedChunk.index,
      textHash: cacheKey,
      status: "processing",
    });

    try {
      const synthesis = await synthesizeWithRetry(deps.tts, {
        text: plannedChunk.text,
        voice: input.voice,
        rate: input.rate,
        pitch: input.pitch,
        fileName: `${input.partId}-${plannedChunk.index}.mp3`,
      });
      const completed = await deps.chunks.updateById(chunk.id, {
        audioPath: synthesis.audio.audioPath,
        status: "completed",
        retryCount: synthesis.retryCount,
        errorMessage: null,
      });
      createdChunks.push(completed ?? chunk);
    } catch (error) {
      failedCount += 1;
      const failed = await deps.chunks.updateById(chunk.id, {
        status: "failed",
        retryCount: retryCountFromError(error),
        errorMessage: toErrorMessage(error),
      });
      createdChunks.push(failed ?? chunk);
    }
  }

  return {
    chunks: createdChunks,
    cacheHits,
    failedCount,
  };
}

async function synthesizeWithRetry(
  tts: TTSProvider,
  input: Parameters<TTSProvider["synthesize"]>[0],
): Promise<{
  audio: Awaited<ReturnType<TTSProvider["synthesize"]>>;
  retryCount: number;
}> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_TTS_ATTEMPTS; attempt += 1) {
    try {
      return {
        audio: await tts.synthesize(input),
        retryCount: attempt,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw new TtsSynthesisAttemptsError(lastError, MAX_TTS_ATTEMPTS - 1);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof TtsSynthesisAttemptsError) {
    return toErrorMessage(error.cause);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "TTS chunk synthesis failed";
}

function retryCountFromError(error: unknown): number {
  return error instanceof TtsSynthesisAttemptsError ? error.retryCount : 0;
}

class TtsSynthesisAttemptsError extends Error {
  constructor(
    readonly cause: unknown,
    readonly retryCount: number,
  ) {
    super(toErrorMessage(cause));
  }
}
