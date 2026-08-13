import { afterEach, describe, expect, it } from "vitest";
import { queryPlayer } from "../src/server/application/queryPlayer";
import {
  createDatabaseClient,
  DrizzleBookRepository,
  DrizzleChunkRepository,
  DrizzleJobRepository,
  DrizzlePartRepository,
  initializeDatabase,
} from "../src/server/infrastructure/db";

const clients: ReturnType<typeof createDatabaseClient>[] = [];

afterEach(() => {
  for (const client of clients.splice(0)) {
    client.sqlite.close();
  }
});

describe("queryPlayer", () => {
  it("returns all parts in order with playable urls only for completed audio", async () => {
    const client = createDatabaseClient(":memory:");
    initializeDatabase(client.db);
    clients.push(client);

    const books = new DrizzleBookRepository(client.db);
    const parts = new DrizzlePartRepository(client.db);
    const chunks = new DrizzleChunkRepository(client.db);
    const jobs = new DrizzleJobRepository(client.db);
    const book = await books.create({
      title: "Test Book",
      sourcePath: "storage/sources/book.txt",
    });
    const job = await jobs.create({
      bookId: book.id,
      voice: "zh-CN-YunxiNeural",
      rate: "+0%",
      pitch: "+0Hz",
      status: "processing",
      stage: "tts",
      progress: 85,
    });
    await parts.create({
      bookId: book.id,
      index: 1,
      title: "Chapter 2",
      audioPath: "storage/parts/part-2.mp3",
      durationSeconds: 20,
      status: "completed",
    });
    await parts.create({
      bookId: book.id,
      index: 0,
      title: "Chapter 1",
      audioPath: "storage/parts/part-1.mp3",
      durationSeconds: 10,
      status: "completed",
    });
    await parts.create({
      bookId: book.id,
      index: 2,
      title: "Chapter 3",
      audioPath: null,
      status: "pending",
    });
    const failedPart = await parts.create({
      bookId: book.id,
      index: 3,
      title: "Chapter 4",
      audioPath: null,
      status: "failed",
    });
    await chunks.create({
      partId: failedPart.id,
      index: 0,
      textHash: "failed-hash",
      status: "failed",
      errorMessage: "No audio was received.",
    });

    const result = await queryPlayer({ books, jobs, parts, chunks }, book.id);

    expect(result).toMatchObject({
      bookId: book.id,
      latestJob: {
        id: job.id,
        status: "processing",
        stage: "tts",
        progress: 85,
      },
      parts: [
        {
          index: 0,
          title: "Chapter 1",
          status: "completed",
          audioUrl: expect.any(String),
          durationSeconds: 10,
          errorMessage: null,
        },
        {
          index: 1,
          title: "Chapter 2",
          status: "completed",
          audioUrl: expect.any(String),
          durationSeconds: 20,
          errorMessage: null,
        },
        {
          index: 2,
          title: "Chapter 3",
          status: "pending",
          audioUrl: null,
          errorMessage: null,
        },
        {
          index: 3,
          title: "Chapter 4",
          status: "failed",
          audioUrl: null,
          errorMessage: "No audio was received.",
        },
      ],
    });
    expect(result?.parts[0].audioUrl).toMatch(
      new RegExp(`/api/player/books/${book.id}\\?partId=`),
    );
  });

  it("returns null when the book is missing", async () => {
    const client = createDatabaseClient(":memory:");
    initializeDatabase(client.db);
    clients.push(client);

    const books = new DrizzleBookRepository(client.db);
    const parts = new DrizzlePartRepository(client.db);

    await expect(queryPlayer({ books, parts }, "missing-book")).resolves.toBeNull();
  });
});
