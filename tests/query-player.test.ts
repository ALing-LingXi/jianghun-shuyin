import { afterEach, describe, expect, it } from "vitest";
import { queryPlayer } from "../src/server/application/queryPlayer";
import {
  createDatabaseClient,
  DrizzleBookRepository,
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
  it("returns playable completed parts in order", async () => {
    const client = createDatabaseClient(":memory:");
    initializeDatabase(client.db);
    clients.push(client);

    const books = new DrizzleBookRepository(client.db);
    const parts = new DrizzlePartRepository(client.db);
    const book = await books.create({
      title: "测试书",
      sourcePath: "storage/sources/book.txt",
    });
    await parts.create({
      bookId: book.id,
      index: 1,
      title: "第二段",
      audioPath: "storage/parts/part-2.mp3",
      durationSeconds: 20,
      status: "completed",
    });
    await parts.create({
      bookId: book.id,
      index: 0,
      title: "第一段",
      audioPath: "storage/parts/part-1.mp3",
      durationSeconds: 10,
      status: "completed",
    });
    await parts.create({
      bookId: book.id,
      index: 2,
      title: "未完成段",
      audioPath: null,
      status: "pending",
    });

    const result = await queryPlayer({ books, parts }, book.id);

    expect(result).toMatchObject({
      bookId: book.id,
      parts: [
        {
          index: 0,
          title: "第一段",
          durationSeconds: 10,
        },
        {
          index: 1,
          title: "第二段",
          durationSeconds: 20,
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
