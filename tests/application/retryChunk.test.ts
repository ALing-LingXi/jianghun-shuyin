import { afterEach, describe, expect, it, vi } from "vitest";
import type { FileStorage } from "../../src/server/ports/storage";
import type { TTSProvider } from "../../src/server/ports/tts";
import {
  RetryChunkError,
  retryChunk,
} from "../../src/server/application/retryChunk";
import {
  createDatabaseClient,
  DrizzleBookRepository,
  DrizzleChunkRepository,
  DrizzlePartRepository,
  initializeDatabase,
} from "../../src/server/infrastructure/db";
import { createChunkCacheKey } from "../../src/server/tts/chunkCache";

const clients: ReturnType<typeof createDatabaseClient>[] = [];

afterEach(() => {
  for (const client of clients.splice(0)) {
    client.sqlite.close();
  }
});

async function createFailedChunk() {
  const client = createDatabaseClient(":memory:");
  initializeDatabase(client.db);
  clients.push(client);

  const books = new DrizzleBookRepository(client.db);
  const parts = new DrizzlePartRepository(client.db);
  const chunks = new DrizzleChunkRepository(client.db);
  const book = await books.create({
    title: "Retry test",
    sourcePath: "storage/sources/retry-test.txt",
  });
  const part = await parts.create({
    bookId: book.id,
    index: 0,
    title: "Part 1",
  });
  const synthesisInput = {
    text: "retry this sentence.",
    voice: "voice-a",
    rate: "+0%",
    pitch: "+0Hz",
  };
  const { cacheKey } = createChunkCacheKey(synthesisInput);
  const chunk = await chunks.create({
    partId: part.id,
    index: 0,
    textHash: cacheKey,
    status: "failed",
    errorMessage: "first attempt failed",
  });

  return { chunks, chunk, synthesisInput };
}

function createFakeTts(
  synthesize: TTSProvider["synthesize"],
): TTSProvider & { synthesize: ReturnType<typeof vi.fn> } {
  return {
    synthesize: vi.fn(synthesize),
  };
}

describe("retryChunk", () => {
  it("retries only the failed chunk and marks it completed", async () => {
    const context = await createFailedChunk();
    const storage = createFakeStorage();
    const tts = createFakeTts(async (input) => ({
      audioPath: `storage/chunks/${input.fileName}`,
      byteLength: 4,
      voice: input.voice,
      rate: input.rate,
      pitch: input.pitch,
    }));

    const result = await retryChunk(
      { chunks: context.chunks, storage, tts },
      {
        chunkId: context.chunk.id,
        ...context.synthesisInput,
      },
    );

    expect(result).toMatchObject({
      id: context.chunk.id,
      status: "completed",
      retryCount: 1,
      errorMessage: null,
    });
    expect(result.audioPath).toContain("retry-1.mp3");
    expect(tts.synthesize).toHaveBeenCalledTimes(1);
  });

  it("records another failure and increments retryCount", async () => {
    const context = await createFailedChunk();
    const storage = createFakeStorage();
    const tts = createFakeTts(async () => {
      throw new Error("retry network error");
    });

    await expect(
      retryChunk(
        { chunks: context.chunks, storage, tts },
        {
          chunkId: context.chunk.id,
          ...context.synthesisInput,
        },
      ),
    ).rejects.toMatchObject({
      code: "CHUNK_RETRY_FAILED",
      message: "retry network error",
    });
    await expect(context.chunks.findById(context.chunk.id)).resolves.toMatchObject({
      status: "failed",
      retryCount: 1,
      errorMessage: "retry network error",
    });
  });

  it("rejects retry parameters that do not match the chunk cache key", async () => {
    const context = await createFailedChunk();
    const storage = createFakeStorage();
    const tts = createFakeTts(async () => {
      throw new Error("should not run");
    });

    await expect(
      retryChunk(
        { chunks: context.chunks, storage, tts },
        {
          chunkId: context.chunk.id,
          ...context.synthesisInput,
          voice: "different-voice",
        },
      ),
    ).rejects.toMatchObject({
      code: "CHUNK_RETRY_KEY_MISMATCH",
      message: "Retry text or voice parameters do not match the chunk",
    } satisfies Partial<RetryChunkError>);
    expect(tts.synthesize).not.toHaveBeenCalled();
  });

  it("does not use a completed chunk cache entry when its audio file is missing", async () => {
    const context = await createFailedChunk();
    const storage = createFakeStorage({ exists: vi.fn(async () => false) });
    const cached = await context.chunks.create({
      partId: context.chunk.partId,
      index: 1,
      textHash: context.chunk.textHash,
      audioPath: "storage/chunks/missing-cache.mp3",
      status: "completed",
    });
    const tts = createFakeTts(async (input) => ({
      audioPath: `storage/chunks/${input.fileName}`,
      byteLength: 4,
      voice: input.voice,
      rate: input.rate,
      pitch: input.pitch,
    }));

    const result = await retryChunk(
      { chunks: context.chunks, storage, tts },
      {
        chunkId: context.chunk.id,
        ...context.synthesisInput,
      },
    );

    expect(storage.exists).toHaveBeenCalledWith(cached.audioPath);
    expect(tts.synthesize).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      id: context.chunk.id,
      status: "completed",
      retryCount: 1,
    });
    expect(result.audioPath).toContain("retry-1.mp3");
    await expect(context.chunks.findById(cached.id)).resolves.toMatchObject({
      audioPath: null,
    });
  });
});

function createFakeStorage(
  overrides: Partial<Omit<FileStorage, "exists">> & {
    exists?: ReturnType<typeof vi.fn>;
  } = {},
): FileStorage & { exists: ReturnType<typeof vi.fn> } {
  return {
    saveTextSource: vi.fn(async () => "storage/sources/source.txt"),
    saveBinarySource: vi.fn(async () => "storage/sources/source.bin"),
    readTextSource: vi.fn(async () => new Uint8Array()),
    saveChunkAudio: vi.fn(async () => "storage/chunks/chunk.mp3"),
    deleteFile: vi.fn(async () => undefined),
    exists: vi.fn(async () => true),
    ...overrides,
  };
}
