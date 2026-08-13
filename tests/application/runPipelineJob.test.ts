import { access, readdir, readFile, rm, unlink, mkdtemp } from "node:fs/promises";
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
  const tts = createFakeTts(storage);
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
    expect(chunkRows.every((chunk) => chunk.audioPath === null)).toBe(true);

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

  it("deletes chunk audio only after a part is assembled successfully", async () => {
    const context = await createTestContext();
    const result = await createBookJob(
      {
        books: context.books,
        jobs: context.jobs,
        storage: context.storage,
      },
      {
        title: "Cleanup test",
        text: "Chapter 1: Wind\nRain fell on the street.",
        voice: "zh-CN-XiaoxiaoNeural",
        rate: "+0%",
        pitch: "+0Hz",
      },
    );

    await runUntilTerminal(context, result.jobId);

    const chunkRows = context.client.db.select().from(chunksTable).all();
    expect(chunkRows).toHaveLength(1);
    expect(chunkRows[0]).toMatchObject({
      status: "completed",
      audioPath: null,
    });
    await expect(readdir(path.join(context.storageRoot, "chunks"))).resolves.toEqual(
      [],
    );
  });

  it("cleans stale chunk audio for already completed parts while continuing the job", async () => {
    const context = await createTestContext();
    const result = await createQueuedJob(context);
    await runPipelineJob(context, result.jobId);
    await runPipelineJob(context, result.jobId);
    await runPipelineJob(context, result.jobId);
    await runPipelineJob(context, result.jobId);
    await runPipelineJob(context, result.jobId);

    const parts = context.client.db.select().from(partsTable).all();
    const firstPart = parts[0];
    if (!firstPart) {
      throw new Error("Expected at least one part to mark completed");
    }

    const completedPart = await context.parts.updateById(firstPart.id, {
      status: "completed",
      audioPath: path.join(context.storageRoot, "parts", "completed.mp3"),
      durationSeconds: 12,
    });
    if (!completedPart) {
      throw new Error("Expected completed part update to succeed");
    }

    const staleChunkPath = await context.storage.saveChunkAudio({
      content: new Uint8Array([1, 2, 3]),
      fileName: "stale.mp3",
    });
    await context.chunks.create({
      partId: completedPart.id,
      index: 0,
      textHash: "stale-hash",
      audioPath: staleChunkPath,
      status: "completed",
    });

    await runPipelineJob(context, result.jobId);

    await expect(access(staleChunkPath)).rejects.toThrow();
    const chunks = await context.chunks.listByPartId(completedPart.id);
    expect(chunks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          textHash: "stale-hash",
          audioPath: null,
          status: "completed",
        }),
      ]),
    );
    expect(chunks.every((chunk) => chunk.audioPath === null)).toBe(true);
  });

  it("keeps chunk audio when part assembly fails", async () => {
    const context = await createTestContext();
    context.audio = createFakeAudio({
      assemblePart: async () => {
        throw new Error("ffmpeg concat failed");
      },
    });
    const result = await createBookJob(
      {
        books: context.books,
        jobs: context.jobs,
        storage: context.storage,
      },
      {
        title: "Failed cleanup test",
        text: "Chapter 1: Wind\nRain fell on the street.",
        voice: "zh-CN-XiaoxiaoNeural",
        rate: "+0%",
        pitch: "+0Hz",
      },
    );

    await runUntilTerminal(context, result.jobId);

    const chunkRows = context.client.db.select().from(chunksTable).all();
    expect(chunkRows).toHaveLength(1);
    expect(chunkRows[0].audioPath).toBeTruthy();
    await expect(access(chunkRows[0].audioPath!)).resolves.toBeUndefined();
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

function createFakeTts(storage?: LocalStorage): TTSProvider {
  return {
    async synthesize(input) {
      if (storage) {
        const audioPath = await storage.saveChunkAudio({
          content: new Uint8Array([0x49, 0x44, 0x33, 0x04]),
          fileName: input.fileName ?? "chunk.mp3",
        });

        return {
          audioPath,
          byteLength: 4,
          voice: input.voice,
          rate: input.rate,
          pitch: input.pitch,
        };
      }

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
