import type { Chunk } from "@/server/domain/entities";
import type { ChunkRepository } from "@/server/ports/repositories";
import type { TTSProvider } from "@/server/ports/tts";
import { buildChunks } from "@/server/tts/buildChunks";
import { createChunkCacheKey } from "@/server/tts/chunkCache";
import {
  createLimiter,
  runWithConcurrency,
  type Limiter,
} from "@/server/tts/concurrency";

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
  concurrency?: number;
  ttsLimiter?: Limiter;
  maxAttempts?: number;
  retryDelaysMs?: readonly number[];
};

export type SynthesizePartChunksResult = {
  chunks: Chunk[];
  cacheHits: number;
  failedCount: number;
};

const DEFAULT_MAX_TTS_ATTEMPTS = 5;
export const DEFAULT_TTS_CHUNK_CONCURRENCY = 2;
export const DEFAULT_GLOBAL_TTS_CONCURRENCY = 3;
const RETRY_DELAYS_MS = [1_000, 3_000, 8_000, 15_000, 30_000] as const;

export async function synthesizePartChunks(
  deps: SynthesizePartChunksDeps,
  input: SynthesizePartChunksInput,
): Promise<SynthesizePartChunksResult> {
  const plannedChunks = buildChunks({
    text: input.text,
    maxCharacters: input.maxCharacters,
  });
  const createdChunks: Chunk[] = new Array(plannedChunks.length);
  const limitTts =
    input.ttsLimiter ?? createLimiter(DEFAULT_GLOBAL_TTS_CONCURRENCY);
  let failedCount = 0;

  await runWithConcurrency(
    plannedChunks,
    input.concurrency ?? DEFAULT_TTS_CHUNK_CONCURRENCY,
    async (plannedChunk, resultIndex) => {
      const { cacheKey } = createChunkCacheKey({
        text: plannedChunk.text,
        voice: input.voice,
        rate: input.rate,
        pitch: input.pitch,
      });

      const chunk = await deps.chunks.create({
        partId: input.partId,
        index: plannedChunk.index,
        textHash: cacheKey,
        status: "processing",
      });

      try {
        const synthesis = await synthesizeWithRetry(
          deps.tts,
          {
            text: plannedChunk.text,
            voice: input.voice,
            rate: input.rate,
            pitch: input.pitch,
            fileName: `${input.partId}-${plannedChunk.index}.mp3`,
          },
          {
            partId: input.partId,
            chunkIndex: plannedChunk.index,
            textHash: cacheKey,
            maxAttempts: input.maxAttempts ?? DEFAULT_MAX_TTS_ATTEMPTS,
            retryDelaysMs: input.retryDelaysMs ?? RETRY_DELAYS_MS,
            ttsLimiter: limitTts,
          },
        );
        const completed = await deps.chunks.updateById(chunk.id, {
          audioPath: synthesis.audio.audioPath,
          status: "completed",
          retryCount: synthesis.retryCount,
          errorMessage: null,
        });
        createdChunks[resultIndex] = completed ?? chunk;
      } catch (error) {
        failedCount += 1;
        const retryCount = retryCountFromError(error);
        const errorMessage = toErrorMessage(error);
        const failed = await deps.chunks.updateById(chunk.id, {
          status: "failed",
          retryCount,
          errorMessage,
        });
        createdChunks[resultIndex] =
          failed ?? {
            ...chunk,
            status: "failed",
            retryCount,
            errorMessage,
          };
      }
    },
  );

  return {
    chunks: createdChunks,
    cacheHits: 0,
    failedCount,
  };
}

async function synthesizeWithRetry(
  tts: TTSProvider,
  input: Parameters<TTSProvider["synthesize"]>[0],
  context: {
    partId: string;
    chunkIndex: number;
    textHash: string;
    maxAttempts: number;
    retryDelaysMs: readonly number[];
    ttsLimiter: Limiter;
  },
): Promise<{
  audio: Awaited<ReturnType<TTSProvider["synthesize"]>>;
  retryCount: number;
}> {
  let lastError: unknown;

  for (let attempt = 0; attempt < context.maxAttempts; attempt += 1) {
    try {
      return {
        audio: await context.ttsLimiter(() => tts.synthesize(input)),
        retryCount: attempt,
      };
    } catch (error) {
      lastError = error;
      const retryable = isRetryableTtsError(error);
      console.warn("[tts] chunk synthesis attempt failed", {
        partId: context.partId,
        chunkIndex: context.chunkIndex,
        textHash: context.textHash,
        maxAttempts: context.maxAttempts,
        attempt: attempt + 1,
        textCharacters: input.text.length,
        textPreview: previewText(input.text),
        voice: input.voice,
        rate: input.rate,
        pitch: input.pitch,
        retryable,
        errorName: errorName(error),
        errorMessage: toErrorMessage(error),
      });

      if (!retryable) {
        throw error;
      }

      if (attempt < context.maxAttempts - 1) {
        await waitForRetry(attempt, context.retryDelaysMs);
      }
    }
  }

  throw new TtsSynthesisAttemptsError(lastError, context.maxAttempts - 1);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof TtsSynthesisAttemptsError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "TTS chunk synthesis failed";
}

function retryCountFromError(error: unknown): number {
  return error instanceof TtsSynthesisAttemptsError ? error.retryCount : 0;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

function previewText(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 120
    ? `${normalized.slice(0, 120)}...`
    : normalized;
}

export function isRetryableTtsError(error: unknown): boolean {
  const name = errorName(error).toLowerCase();
  const message = toErrorMessage(error).toLowerCase();
  const combined = `${name} ${message}`;

  if (/\b5\d\d\b/.test(combined)) {
    return true;
  }

  return [
    "noaudioreceived",
    "no audio was received",
    "websocket",
    "socket",
    "timeout",
    "timed out",
    "econnreset",
    "etimedout",
    "rate limit",
    "429",
  ].some((token) => combined.includes(token));
}

async function waitForRetry(
  attempt: number,
  retryDelaysMs: readonly number[],
): Promise<void> {
  const delayMs =
    retryDelaysMs[Math.min(attempt, retryDelaysMs.length - 1)] ?? 0;
  if (delayMs <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

class TtsSynthesisAttemptsError extends Error {
  constructor(
    readonly cause: unknown,
    readonly retryCount: number,
  ) {
    super(
      `${toErrorMessage(cause)} (after ${retryCount + 1} TTS attempts)`,
    );
  }
}
