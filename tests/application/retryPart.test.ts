import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { retryPart } from "../../src/server/application/retryPart";
import {
  createDatabaseClient,
  DrizzleBookRepository,
  DrizzleChunkRepository,
  DrizzleJobRepository,
  DrizzlePartRepository,
  initializeDatabase,
} from "../../src/server/infrastructure/db";
import { LocalStorage } from "../../src/server/infrastructure/localStorage";

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

async function createTestContext() {
  const client = createDatabaseClient(":memory:");
  initializeDatabase(client.db);
  clients.push(client);

  const storageRoot = await mkdtemp(path.join(os.tmpdir(), "jianghun-retry-part-"));
  tempRoots.push(storageRoot);

  const books = new DrizzleBookRepository(client.db);
  const jobs = new DrizzleJobRepository(client.db);
  const parts = new DrizzlePartRepository(client.db);
  const chunks = new DrizzleChunkRepository(client.db);
  const storage = new LocalStorage(storageRoot);
  const book = await books.create({
    title: "Retry Book",
    sourcePath: "storage/sources/retry.txt",
  });
  const job = await jobs.create({
    bookId: book.id,
    voice: "zh-CN-XiaoxiaoNeural",
    rate: "+0%",
    pitch: "+0Hz",
    status: "completed_with_errors",
    stage: "completed",
    progress: 100,
    errorMessage: "1 chapter(s) failed.",
  });
  const audioPath = path.join(storageRoot, "chunks", "failed.mp3");
  await mkdir(path.dirname(audioPath), { recursive: true });
  await writeFile(audioPath, new Uint8Array([1, 2, 3]));
  const part = await parts.create({
    bookId: book.id,
    index: 0,
    title: "Chapter 1",
    status: "failed",
    audioPath: path.join(storageRoot, "parts", "chapter.mp3"),
    durationSeconds: 12,
  });
  await chunks.create({
    partId: part.id,
    index: 0,
    textHash: "hash",
    status: "failed",
    audioPath,
    errorMessage: "No audio was received.",
  });

  return { books, jobs, parts, chunks, storage, book, job, part, audioPath };
}

describe("retryPart", () => {
  it("resets a failed part and queues its job for worker processing", async () => {
    const context = await createTestContext();

    const result = await retryPart(context, { partId: context.part.id });

    expect(result).toMatchObject({
      id: context.part.id,
      status: "pending",
      audioPath: null,
      durationSeconds: null,
    });
    await expect(context.chunks.listByPartId(context.part.id)).resolves.toEqual([]);
    await expect(context.jobs.findById(context.job.id)).resolves.toMatchObject({
      status: "processing",
      stage: "tts",
      errorMessage: null,
    });
  });

  it("rejects retrying parts that are not failed", async () => {
    const context = await createTestContext();
    await context.parts.updateById(context.part.id, { status: "completed" });

    await expect(
      retryPart(context, { partId: context.part.id }),
    ).rejects.toMatchObject({
      code: "PART_NOT_FAILED",
    });
  });
});
