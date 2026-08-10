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
      const audio = await deps.tts.synthesize({
        text: plannedChunk.text,
        voice: input.voice,
        rate: input.rate,
        pitch: input.pitch,
        fileName: `${input.partId}-${plannedChunk.index}.mp3`,
      });
      const completed = await deps.chunks.updateById(chunk.id, {
        audioPath: audio.audioPath,
        status: "completed",
        errorMessage: null,
      });
      createdChunks.push(completed ?? chunk);
    } catch (error) {
      failedCount += 1;
      const failed = await deps.chunks.updateById(chunk.id, {
        status: "failed",
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

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "TTS chunk synthesis failed";
}
