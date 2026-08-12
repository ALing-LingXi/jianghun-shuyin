import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createBookJob } from "../src/server/application/createBookJob";
import {
  createDatabaseClient,
  DrizzleBookRepository,
  DrizzleJobRepository,
  initializeDatabase,
} from "../src/server/infrastructure/db";
import { LocalStorage } from "../src/server/infrastructure/localStorage";

const clients: ReturnType<typeof createDatabaseClient>[] = [];
const tempRoots: string[] = [];

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.sqlite.close();
  }

  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("createBookJob", () => {
  it("stores the source and creates a queued job", async () => {
    const client = createDatabaseClient(":memory:");
    initializeDatabase(client.db);
    clients.push(client);

    const storageRoot = await mkdtemp(path.join(os.tmpdir(), "jianghun-shuyin-"));
    tempRoots.push(storageRoot);

    const books = new DrizzleBookRepository(client.db);
    const jobs = new DrizzleJobRepository(client.db);
    const storage = new LocalStorage(storageRoot);
    const result = await createBookJob(
      { books, jobs, storage },
      {
        title: "三体",
        author: "刘慈欣",
        text: "\n这是正文。\n",
        voice: "zh-CN-XiaoxiaoNeural",
        rate: "+0%",
        pitch: "+0Hz",
      },
    );

    const book = await books.findById(result.bookId);
    const job = await jobs.findById(result.jobId);

    expect(book).not.toBeNull();
    expect(book).toMatchObject({
      title: "三体",
      author: "刘慈欣",
      status: "pending",
    });
    expect(job).toMatchObject({
      bookId: result.bookId,
      voice: "zh-CN-XiaoxiaoNeural",
      rate: "+0%",
      pitch: "+0Hz",
      status: "queued",
      stage: "decoding",
      progress: 0,
    });
    await expect(readFile(book!.sourcePath, "utf8")).resolves.toBe(
      "\n这是正文。\n",
    );
  });
});
