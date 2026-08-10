import { createHash } from "node:crypto";

export type ChunkCacheKeyInput = {
  text: string;
  voice: string;
  rate: string;
  pitch: string;
};

export type ChunkCacheKey = {
  textHash: string;
  cacheKey: string;
};

export function createChunkCacheKey(input: ChunkCacheKeyInput): ChunkCacheKey {
  const textHash = sha256(input.text);
  const voice = normalizeCachePart(input.voice);
  const rate = normalizeCachePart(input.rate);
  const pitch = normalizeCachePart(input.pitch);

  return {
    textHash,
    cacheKey: `tts:v1:text=${textHash}:voice=${voice}:rate=${rate}:pitch=${pitch}`,
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeCachePart(value: string): string {
  return encodeURIComponent(value.trim());
}
