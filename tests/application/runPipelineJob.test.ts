import { readdir, readFile, rm, unlink, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createBookJob } from "../../src/server/application/createBookJob";
import { runPipelineJob } from "../../src/server/application/runPipelineJob";
import {
  createDatabaseClient,
  DrizzleBookRepository,
  DrizzleJobRepository,
  DrizzlePartRepository,
  initializeDatabase,
} from "../../src/server/infrastructure/db";
import { parts as partsTable } from "../../src/server/infrastructure/db/schema";
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

  const storageRoot = await mkdtemp(path.join(os.tmpdir(), "jianghun-pipeline-"));
  tempRoots.push(storageRoot);

  const books = new DrizzleBookRepository(client.db);
  const jobs = new DrizzleJobRepository(client.db);
  const parts = new DrizzlePartRepository(client.db);
  const storage = new LocalStorage(storageRoot);

  return { client, storageRoot, books, jobs, parts, storage };
}

async function createQueuedJob(
  context: Awaited<ReturnType<typeof createTestContext>>,
) {
  return createBookJob(
    {
      books: context.books,
      jobs: context.jobs,
      storage: context.storage,
    },
    {
      title: "江湖旧事",
      text: [
        "第一章 风起",
        "夜雨落在青石街上。",
        "",
        "第二章 灯火",
        "客栈里的灯还亮着。",
      ].join("\n"),
      voice: "zh-CN-XiaoxiaoNeural",
      rate: "+0%",
      pitch: "+0Hz",
    },
  );
}

describe("runPipelineJob", () => {
  it("reads source text, creates part records, and writes cleaned/report files", async () => {
    const context = await createTestContext();
    const result = await createQueuedJob(context);

    for (let step = 0; step < 5; step += 1) {
      await runPipelineJob(context, result.jobId);
    }

    await expect(context.jobs.findById(result.jobId)).resolves.toMatchObject({
      status: "completed",
      stage: "completed",
      progress: 100,
      errorMessage: null,
    });

    const partRows = context.client.db.select().from(partsTable).all();
    expect(partRows).toHaveLength(2);
    expect(partRows.map((part) => part.title)).toEqual([
      "第一章 风起",
      "第二章 灯火",
    ]);

    const cleanedFiles = await readdir(path.join(context.storageRoot, "cleaned"));
    expect(cleanedFiles).toHaveLength(1);
    await expect(
      readFile(path.join(context.storageRoot, "cleaned", cleanedFiles[0]), "utf8"),
    ).resolves.toContain("夜雨落在青石街上。");

    const reportFiles = await readdir(path.join(context.storageRoot, "reports"));
    expect(reportFiles).toHaveLength(1);
    const reportPayload = JSON.parse(
      await readFile(
        path.join(context.storageRoot, "reports", reportFiles[0]),
        "utf8",
      ),
    ) as { report: { chapterCount: number; partCount: number } };
    expect(reportPayload.report).toMatchObject({
      chapterCount: 2,
      partCount: 2,
    });
  });

  it("marks jobs as failed when source parsing cannot continue", async () => {
    const context = await createTestContext();
    const result = await createQueuedJob(context);
    const book = await context.books.findById(result.bookId);
    expect(book).not.toBeNull();

    await unlink(book!.sourcePath);
    await runPipelineJob(context, result.jobId);
    await runPipelineJob(context, result.jobId);

    const failedJob = await context.jobs.findById(result.jobId);
    expect(failedJob).toMatchObject({
      status: "failed",
      stage: "decoding",
      progress: 10,
    });
    expect(failedJob?.errorMessage).toBeTruthy();
  });
});
