export type PlannedChunk = {
  index: number;
  text: string;
  characterCount: number;
};

export type BuildChunksInput = {
  text: string;
  maxCharacters?: number;
};

const DEFAULT_MAX_CHUNK_CHARACTERS = 350;

export function buildChunks(input: BuildChunksInput): PlannedChunk[] {
  const maxCharacters = input.maxCharacters ?? DEFAULT_MAX_CHUNK_CHARACTERS;
  const text = normalizeChunkText(input.text);

  if (!text) {
    return [];
  }

  if (maxCharacters < 1) {
    throw new Error("maxCharacters must be greater than 0");
  }

  const chunks: string[] = [];
  let current = "";

  for (const segment of splitIntoSegments(text)) {
    if (segment.length > maxCharacters) {
      if (current) {
        chunks.push(current);
        current = "";
      }

      chunks.push(...splitLongSegment(segment, maxCharacters));
      continue;
    }

    const next = current ? `${current}\n${segment}` : segment;
    if (next.length > maxCharacters) {
      chunks.push(current);
      current = segment;
      continue;
    }

    current = next;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.map((chunk, index) => ({
    index,
    text: chunk,
    characterCount: chunk.length,
  }));
}

function normalizeChunkText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function splitIntoSegments(text: string): string[] {
  const segments: string[] = [];

  for (const paragraph of text.split(/\n+/u)) {
    const sentences =
      paragraph.match(
        /[^\u3002\uFF01\uFF1F\uFF1B.!?]+[\u3002\uFF01\uFF1F\uFF1B.!?]+|[^\u3002\uFF01\uFF1F\uFF1B.!?]+$/gu,
      ) ?? [];

    for (const sentence of sentences) {
      const normalized = sentence.trim();
      if (normalized) {
        segments.push(normalized);
      }
    }
  }

  return segments;
}

function splitLongSegment(segment: string, maxCharacters: number): string[] {
  const chunks: string[] = [];

  for (let offset = 0; offset < segment.length; offset += maxCharacters) {
    chunks.push(segment.slice(offset, offset + maxCharacters));
  }

  return chunks;
}
