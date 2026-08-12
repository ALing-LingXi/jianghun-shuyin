import { readdir, readFile, rm, unlink, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AudioAssembler } from "../../src/server/ports/audio";
import type { TTSProvider } from "../../src/server/ports/tts";
import { createBookJob } from "../../src/server/application/createBookJob";
import { runPipelineJob } from "../../src/server/application/runPipelineJob";
import {
  createDatabaseClient,
  DrizzleBookRepository,
  DrizzleChunkRepository,
  DrizzleJobRepository,
  DrizzlePartRepository,
  initializeDatabase,
} from "../../src/server/infrastructure/db";
import {
  chunks as chunksTable,
  parts as partsTable,
} from "../../src/server/infrastructure/db/schema";
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
  const chunks = new DrizzleChunkRepository(client.db);
  const storage = new LocalStorage(storageRoot);
  const tts = createFakeTts();
  const audio = createFakeAudio();

  return { client, storageRoot, books, jobs, parts, chunks, storage, tts, audio };
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
      title: "Pipeline test",
      text: [
        "Chapter 1: Wind",
        "Rain fell on the street.",
        "",
        "Chapter 2: Fire",
        "The inn lamp was still bright.",
      ].join("\n"),
      voice: "zh-CN-XiaoxiaoNeural",
      rate: "+0%",
      pitch: "+0Hz",
    },
  );
}

describe("runPipelineJob", () => {
  it("creates parts, chunks, assembled part audio, and cleaned/report files", async () => {
    const context = await createTestContext();
    const result = await createQueuedJob(context);

    for (let step = 0; step < 7; step += 1) {
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
    expect(partRows[0]).toMatchObject({
      title: "Chapter 1: Wind",
      status: "completed",
      durationSeconds: 12,
    });
    expect(partRows[1]).toMatchObject({
      title: "Chapter 2: Fire",
      status: "completed",
      durationSeconds: 12,
    });
    expect(partRows.every((part) => part.audioPath?.includes("storage/parts"))).toBe(
      true,
    );

    const chunkRows = context.client.db.select().from(chunksTable).all();
    expect(chunkRows).toHaveLength(2);
    expect(chunkRows.every((chunk) => chunk.status === "completed")).toBe(true);
    expect(chunkRows.every((chunk) => chunk.errorMessage === null)).toBe(true);

    const cleanedFiles = await readdir(path.join(context.storageRoot, "cleaned"));
    expect(cleanedFiles).toHaveLength(1);
    await expect(
      readFile(path.join(context.storageRoot, "cleaned", cleanedFiles[0]), "utf8"),
    ).resolves.toContain("Rain fell on the street.");

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

  it("marks jobs as failed when part assembly fails", async () => {
    const context = await createTestContext();
    context.audio = createFakeAudio({
      assemblePart: async () => {
        throw new Error("ffmpeg concat failed");
      },
    });
    const result = await createQueuedJob(context);

    for (let step = 0; step < 7; step += 1) {
      await runPipelineJob(context, result.jobId);
    }

    await expect(context.jobs.findById(result.jobId)).resolves.toMatchObject({
      status: "failed",
      stage: "assembling",
      progress: 95,
      errorMessage: "ffmpeg concat failed",
    });
    const partRows = context.client.db.select().from(partsTable).all();
    expect(partRows.some((part) => part.status === "failed")).toBe(true);
  });
});

function createFakeTts(): TTSProvider {
  return {
    async synthesize(input) {
      return {
        audioPath: `storage/chunks/${input.fileName}`,
        byteLength: 4,
        voice: input.voice,
        rate: input.rate,
        pitch: input.pitch,
      };
    },
  };
}

function createFakeAudio(
  overrides: Partial<AudioAssembler> = {},
): AudioAssembler {
  return {
    async checkAvailable() {
      return undefined;
    },
    async assemblePart(input) {
      return {
        audioPath: `storage/parts/${input.fileName}`,
        durationSeconds: 12,
      };
    },
    async readDurationSeconds() {
      return 12;
    },
    ...overrides,
  };
}
