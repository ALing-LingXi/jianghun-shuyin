import { afterEach, describe, expect, it } from "vitest";
import { queryLibrary } from "../src/server/application/queryLibrary";
import {
  createDatabaseClient,
  DrizzleBookRepository,
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

describe("queryLibrary", () => {
  it("returns recent books with latest job and counts", async () => {
    const client = createDatabaseClient(":memory:");
    initializeDatabase(client.db);
    clients.push(client);

    const books = new DrizzleBookRepository(client.db);
    const jobs = new DrizzleJobRepository(client.db);
    const parts = new DrizzlePartRepository(client.db);

    const book = await books.create({
      title: "Test Book",
      author: "Lin",
      sourcePath: "storage/sources/book.txt",
    });
    await jobs.create({
      bookId: book.id,
      status: "completed",
      stage: "completed",
      progress: 100,
    });
    await parts.create({
      bookId: book.id,
      index: 0,
      title: "Chapter 1",
      audioPath: "storage/parts/part-1.mp3",
      durationSeconds: 30,
      status: "completed",
    });

    const result = await queryLibrary({ books, jobs, parts });

    expect(result.books).toHaveLength(1);
    expect(result.books[0]).toMatchObject({
      id: book.id,
      title: "Test Book",
      latestJob: {
        status: "completed",
        stage: "completed",
        progress: 100,
      },
      partCount: 1,
      playablePartCount: 1,
      durationSeconds: 30,
    });
  });
});
