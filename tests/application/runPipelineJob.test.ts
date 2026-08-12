import { readdir, readFile, rm, unlink, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
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

    await runUntilTerminal(context, result.jobId);

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

  it("marks parts as failed when part assembly fails and keeps later chapters running", async () => {
    const context = await createTestContext();
    context.audio = createFakeAudio({
      assemblePart: async () => {
        throw new Error("ffmpeg concat failed");
      },
    });
    const result = await createQueuedJob(context);

    await runUntilTerminal(context, result.jobId);

    await expect(context.jobs.findById(result.jobId)).resolves.toMatchObject({
      status: "completed_with_errors",
      stage: "completed",
      progress: 100,
    });
    const partRows = context.client.db.select().from(partsTable).all();
    expect(partRows.every((part) => part.status === "failed")).toBe(true);
  });

  it("keeps a failed TTS chapter unavailable and continues later chapters", async () => {
    const context = await createTestContext();
    let attempts = 0;
    context.tts = {
      synthesize: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("TTS text cannot be empty");
        }

        return {
          audioPath: `storage/chunks/success-${attempts}.mp3`,
          byteLength: 4,
          voice: "zh-CN-XiaoxiaoNeural",
          rate: "+0%",
          pitch: "+0Hz",
        };
      },
    };
    const result = await createQueuedJob(context);

    await runUntilTerminal(context, result.jobId);

    await expect(context.jobs.findById(result.jobId)).resolves.toMatchObject({
      status: "completed_with_errors",
      stage: "completed",
      progress: 100,
    });
    const partRows = context.client.db.select().from(partsTable).all();
    expect(partRows.map((part) => part.status)).toEqual(["failed", "completed"]);
    expect(partRows[0].audioPath).toBeNull();
    expect(partRows[1].audioPath).toContain("storage/parts");
  });

  it("uses the voice selected when the job was created", async () => {
    const context = await createTestContext();
    const synthesize = vi.fn(createFakeTts().synthesize);
    context.tts = { synthesize };
    const result = await createBookJob(
      {
        books: context.books,
        jobs: context.jobs,
        storage: context.storage,
      },
      {
        title: "Voice test",
        text: "Chapter 1: Wind\nRain fell on the street.",
        voice: "zh-CN-XiaoxiaoNeural",
        rate: "+10%",
        pitch: "+5Hz",
      },
    );

    await runUntilTerminal(context, result.jobId);

    expect(synthesize).toHaveBeenCalledWith(
      expect.objectContaining({
        voice: "zh-CN-XiaoxiaoNeural",
        rate: "+10%",
        pitch: "+5Hz",
      }),
    );
  });
});

async function runUntilTerminal(
  context: Awaited<ReturnType<typeof createTestContext>>,
  jobId: string,
) {
  for (let step = 0; step < 20; step += 1) {
    await runPipelineJob(context, jobId);
    const job = await context.jobs.findById(jobId);
    if (
      job?.status === "completed" ||
      job?.status === "completed_with_errors" ||
      job?.status === "failed" ||
      job?.status === "cancelled"
    ) {
      return;
    }
  }

  throw new Error("Job did not reach a terminal state");
}

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
