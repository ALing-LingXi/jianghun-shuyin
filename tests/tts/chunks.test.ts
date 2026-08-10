import { afterEach, describe, expect, it, vi } from "vitest";
import type { TTSProvider } from "../../src/server/ports/tts";
import {
  createDatabaseClient,
  DrizzleBookRepository,
  DrizzleChunkRepository,
  DrizzlePartRepository,
  initializeDatabase,
} from "../../src/server/infrastructure/db";
import {
  buildChunks,
  createChunkCacheKey,
  synthesizePartChunks,
} from "../../src/server/tts";

const clients: ReturnType<typeof createDatabaseClient>[] = [];

afterEach(() => {
  for (const client of clients.splice(0)) {
    client.sqlite.close();
  }
});

async function createTestContext() {
  const client = createDatabaseClient(":memory:");
  initializeDatabase(client.db);
  clients.push(client);

  const books = new DrizzleBookRepository(client.db);
  const parts = new DrizzlePartRepository(client.db);
  const chunks = new DrizzleChunkRepository(client.db);
  const book = await books.create({
    title: "Chunk test",
    sourcePath: "storage/sources/chunk-test.txt",
  });
  const part = await parts.create({
    bookId: book.id,
    index: 0,
    title: "Part 1",
  });

  return { parts, chunks, book, part };
}

function createFakeTts(
  synthesize: TTSProvider["synthesize"],
): TTSProvider & { synthesize: ReturnType<typeof vi.fn> } {
  return {
    synthesize: vi.fn(synthesize),
  };
}

describe("buildChunks", () => {
  it("splits long text at sentence boundaries", () => {
    const text = [
      `first sentence.\u7b2c\u4e8c\u53e5\u3002`,
      "third sentence is longer.",
      "fourth sentence.",
    ].join("");
    const chunks = buildChunks({ text, maxCharacters: 24 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.characterCount <= 24)).toBe(true);
    expect(chunks.map((chunk) => chunk.text).join("").replace(/\n/g, "")).toBe(
      text,
    );
  });

  it("hard-splits a segment without punctuation", () => {
    const chunks = buildChunks({
      text: "abcdefghijklmnopqrstuvwxyz",
      maxCharacters: 10,
    });

    expect(chunks.map((chunk) => chunk.characterCount)).toEqual([10, 10, 6]);
  });
});

describe("chunk cache key", () => {
  it("changes when voice, rate, or pitch changes", () => {
    const base = {
      text: "same text",
      voice: "voice-a",
      rate: "+0%",
      pitch: "+0Hz",
    };
    const original = createChunkCacheKey(base);

    expect(createChunkCacheKey(base)).toEqual(original);
    expect(createChunkCacheKey({ ...base, voice: "voice-b" }).cacheKey).not.toBe(
      original.cacheKey,
    );
    expect(createChunkCacheKey({ ...base, rate: "+10%" }).cacheKey).not.toBe(
      original.cacheKey,
    );
    expect(createChunkCacheKey({ ...base, pitch: "+5Hz" }).cacheKey).not.toBe(
      original.cacheKey,
    );
    expect(original.cacheKey).toContain(original.textHash);
  });
});

describe("synthesizePartChunks", () => {
  it("creates multiple completed chunk records for long text", async () => {
    const context = await createTestContext();
    const tts = createFakeTts(async (input) => ({
      audioPath: `storage/chunks/${input.fileName}`,
      byteLength: 4,
      voice: input.voice,
      rate: input.rate,
      pitch: input.pitch,
    }));

    const result = await synthesizePartChunks(
      { chunks: context.chunks, tts },
      {
        partId: context.part.id,
        text: "one sentence. two sentence. three sentence.",
        voice: "voice-a",
        rate: "+0%",
        pitch: "+0Hz",
        maxCharacters: 18,
      },
    );

    expect(result.chunks.length).toBeGreaterThan(1);
    expect(result.failedCount).toBe(0);
    expect(result.chunks.every((chunk) => chunk.status === "completed")).toBe(
      true,
    );
    expect(tts.synthesize).toHaveBeenCalledTimes(result.chunks.length);
  });

  it("reuses completed audio for identical text and parameters", async () => {
    const context = await createTestContext();
    const secondPart = await context.parts.create({
      bookId: context.book.id,
      index: 1,
      title: "Part 2",
    });
    const tts = createFakeTts(async (input) => ({
      audioPath: `storage/chunks/${input.fileName}`,
      byteLength: 4,
      voice: input.voice,
      rate: input.rate,
      pitch: input.pitch,
    }));
    const input = {
      text: "repeatable text.",
      voice: "voice-a",
      rate: "+0%",
      pitch: "+0Hz",
    };

    const first = await synthesizePartChunks(
      { chunks: context.chunks, tts },
      { partId: context.part.id, ...input },
    );
    const second = await synthesizePartChunks(
      { chunks: context.chunks, tts },
      { partId: secondPart.id, ...input },
    );

    expect(tts.synthesize).toHaveBeenCalledTimes(1);
    expect(second.cacheHits).toBe(1);
    expect(second.chunks[0].audioPath).toBe(first.chunks[0].audioPath);
  });

  it("does not reuse audio when voice, rate, or pitch changes", async () => {
    const context = await createTestContext();
    const tts = createFakeTts(async (input) => ({
      audioPath: `storage/chunks/${input.voice}-${input.rate}-${input.pitch}.mp3`,
      byteLength: 4,
      voice: input.voice,
      rate: input.rate,
      pitch: input.pitch,
    }));
    const variants = [
      { voice: "voice-a", rate: "+0%", pitch: "+0Hz" },
      { voice: "voice-b", rate: "+0%", pitch: "+0Hz" },
      { voice: "voice-a", rate: "+10%", pitch: "+0Hz" },
      { voice: "voice-a", rate: "+0%", pitch: "+5Hz" },
    ];

    for (const [index, settings] of variants.entries()) {
      const part =
        index === 0
          ? context.part
          : await context.parts.create({
              bookId: context.book.id,
              index,
              title: `Part ${index + 1}`,
            });
      const result = await synthesizePartChunks(
        { chunks: context.chunks, tts },
        {
          partId: part.id,
          text: "same text with different settings.",
          ...settings,
        },
      );

      expect(result.cacheHits).toBe(0);
    }

    expect(tts.synthesize).toHaveBeenCalledTimes(variants.length);
  });

  it("records failed TTS chunks without losing the error", async () => {
    const context = await createTestContext();
    const tts = createFakeTts(async () => {
      throw new Error("fake TTS unavailable");
    });

    const result = await synthesizePartChunks(
      { chunks: context.chunks, tts },
      {
        partId: context.part.id,
        text: "failed sentence.",
        voice: "voice-a",
        rate: "+0%",
        pitch: "+0Hz",
      },
    );

    expect(result.failedCount).toBe(1);
    expect(result.chunks[0]).toMatchObject({
      status: "failed",
      retryCount: 0,
      errorMessage: "fake TTS unavailable",
    });
    await expect(
      context.chunks.findById(result.chunks[0].id),
    ).resolves.toMatchObject({
      status: "failed",
      errorMessage: "fake TTS unavailable",
    });
  });
});
