import { afterEach, describe, expect, it } from "vitest";
import {
  createDatabaseClient,
  DrizzleBookRepository,
  DrizzleChunkRepository,
  DrizzleJobRepository,
  DrizzlePartRepository,
  initializeDatabase,
} from "../src/server/infrastructure/db";

const clients: ReturnType<typeof createDatabaseClient>[] = [];

function createTestDatabase() {
  const client = createDatabaseClient(":memory:");
  initializeDatabase(client.db);
  clients.push(client);
  return client;
}

afterEach(() => {
  for (const client of clients.splice(0)) {
    client.sqlite.close();
  }
});

describe("Drizzle repositories", () => {
  it("creates and finds a book", async () => {
    const { db } = createTestDatabase();
    const repository = new DrizzleBookRepository(db);

    const created = await repository.create({
      title: "三体",
      author: "刘慈欣",
      sourcePath: "storage/sources/three-body.txt",
    });

    await expect(repository.findById(created.id)).resolves.toEqual(created);
    await expect(repository.findById("missing-book")).resolves.toBeNull();
  });

  it("creates and finds a job for an existing book", async () => {
    const { db } = createTestDatabase();
    const books = new DrizzleBookRepository(db);
    const jobs = new DrizzleJobRepository(db);
    const book = await books.create({
      title: "三体",
      sourcePath: "storage/sources/three-body.txt",
    });

    const created = await jobs.create({
      bookId: book.id,
      voice: "zh-CN-YunxiNeural",
      rate: "+0%",
      pitch: "+0Hz",
    });

    expect(created).toMatchObject({
      bookId: book.id,
      voice: "zh-CN-YunxiNeural",
      rate: "+0%",
      pitch: "+0Hz",
      status: "queued",
      stage: "decoding",
      progress: 0,
      errorMessage: null,
    });
    await expect(jobs.findById(created.id)).resolves.toEqual(created);
    await expect(jobs.findById("missing-job")).resolves.toBeNull();
  });

  it("creates and finds a part for an existing book", async () => {
    const { db } = createTestDatabase();
    const books = new DrizzleBookRepository(db);
    const parts = new DrizzlePartRepository(db);
    const book = await books.create({
      title: "三体",
      sourcePath: "storage/sources/three-body.txt",
    });

    const created = await parts.create({
      bookId: book.id,
      index: 0,
      title: "第一章",
    });

    expect(created).toMatchObject({
      bookId: book.id,
      index: 0,
      title: "第一章",
      audioPath: null,
      durationSeconds: null,
      status: "pending",
    });
    await expect(parts.findById(created.id)).resolves.toEqual(created);
    await expect(parts.findById("missing-part")).resolves.toBeNull();
  });

  it("creates and finds a chunk for an existing part", async () => {
    const { db } = createTestDatabase();
    const books = new DrizzleBookRepository(db);
    const parts = new DrizzlePartRepository(db);
    const chunks = new DrizzleChunkRepository(db);
    const book = await books.create({
      title: "三体",
      sourcePath: "storage/sources/three-body.txt",
    });
    const part = await parts.create({
      bookId: book.id,
      index: 0,
      title: "第一章",
    });

    const created = await chunks.create({
      partId: part.id,
      index: 0,
      textHash: "hash-001",
      retryCount: 1,
    });

    expect(created).toMatchObject({
      partId: part.id,
      index: 0,
      textHash: "hash-001",
      audioPath: null,
      status: "pending",
      retryCount: 1,
      errorMessage: null,
    });
    await expect(chunks.findById(created.id)).resolves.toEqual(created);
    await expect(chunks.findById("missing-chunk")).resolves.toBeNull();
  });
});
