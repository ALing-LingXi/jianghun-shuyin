import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AudioAssembler } from "../src/server/ports/audio";
import type { TTSProvider } from "../src/server/ports/tts";
import { createBookJob } from "../src/server/application/createBookJob";
import {
  createDatabaseClient,
  DrizzleBookRepository,
  DrizzleJobRepository,
  DrizzlePartRepository,
  initializeDatabase,
  type DatabaseClient,
} from "../src/server/infrastructure/db";
import { createLocalJobRunner } from "../src/server/infrastructure/localJobRunner";
import type { LocalJobRunner } from "../src/server/infrastructure/localJobRunner";
import { LocalStorage } from "../src/server/infrastructure/localStorage";

const clients: DatabaseClient[] = [];
const runners: LocalJobRunner[] = [];
const tempDirs: string[] = [];

function createTempDatabasePath() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "jianghun-worker-"));
  tempDirs.push(dir);
  return path.join(dir, "test.db");
}

afterEach(() => {
  for (const runner of runners.splice(0)) {
    runner.stop();
  }

  for (const client of clients.splice(0)) {
    client.sqlite.close();
  }

  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("LocalJobRunner", () => {
  it("advances queued jobs and eventually completes them", async () => {
    const databasePath = createTempDatabasePath();
    const storageRoot = path.dirname(databasePath);
    const client = createDatabaseClient(databasePath);
    initializeDatabase(client.db);
    clients.push(client);

    const books = new DrizzleBookRepository(client.db);
    const jobs = new DrizzleJobRepository(client.db);
    const storage = new LocalStorage(storageRoot);
    const result = await createBookJob(
      { books, jobs, storage },
      {
        title: "Worker test",
        text: "Chapter 1 Start\nThis is body text.",
        voice: "zh-CN-XiaoxiaoNeural",
        rate: "+0%",
        pitch: "+0Hz",
      },
    );
    const runner = createLocalJobRunner({
      databasePath,
      storageRoot,
      tts: createFakeTts(),
      audio: createFakeAudio(),
      intervalMs: 1000,
    });
    runners.push(runner);

    await expect(runner.runOnce()).resolves.toBe(1);
    await waitFor(async () => {
      const job = await jobs.findById(result.jobId);
      return (
        job !== null &&
        job.status !== "queued" &&
        job.progress >= 10
      );
    });

    await runRunnerUntil(runner, async () => {
      const job = await jobs.findById(result.jobId);
      return (
        job?.status === "completed" &&
        job.stage === "completed" &&
        job.progress === 100
      );
    }, 2000);
  });

  it("advances multiple jobs in the same tick without waiting for the slowest job", async () => {
    const databasePath = createTempDatabasePath();
    const storageRoot = path.dirname(databasePath);
    const client = createDatabaseClient(databasePath);
    initializeDatabase(client.db);
    clients.push(client);

    const books = new DrizzleBookRepository(client.db);
    const jobs = new DrizzleJobRepository(client.db);
    const parts = new DrizzlePartRepository(client.db);
    const storage = new LocalStorage(storageRoot);
    const first = await createBookJob(
      { books, jobs, storage },
      {
        title: "Slow worker test",
        text: "Chapter 1 Start\nThis is body text.",
        voice: "zh-CN-XiaoxiaoNeural",
        rate: "+0%",
        pitch: "+0Hz",
      },
    );
    const second = await createBookJob(
      { books, jobs, storage },
      {
        title: "Fast worker test",
        text: "Chapter 1 Start\nThis is body text.",
        voice: "zh-CN-XiaoxiaoNeural",
        rate: "+0%",
        pitch: "+0Hz",
      },
    );

    await jobs.updateById(first.jobId, {
      status: "processing",
      stage: "tts",
      progress: 85,
    });
    await jobs.updateById(second.jobId, {
      status: "processing",
      stage: "tts",
      progress: 85,
    });
    const firstPart = await parts.create({
      bookId: first.bookId,
      index: 0,
      title: "Chapter 1 Start",
      status: "pending",
    });
    await parts.create({
      bookId: second.bookId,
      index: 0,
      title: "Chapter 1 Start",
      status: "pending",
    });

    let releaseSlowTts: (() => void) | undefined;
    let resolveSlowStarted: (() => void) | undefined;
    const slowTtsBlocked = new Promise<void>((resolve) => {
      releaseSlowTts = resolve;
    });
    const slowTtsStarted = new Promise<void>((resolve) => {
      resolveSlowStarted = resolve;
    });
    const tts = createFakeTts(async (input) => {
      if (input.fileName?.startsWith(firstPart.id)) {
        resolveSlowStarted?.();
        await slowTtsBlocked;
      }

      return {
        audioPath: `storage/chunks/${input.fileName}`,
        byteLength: 4,
        voice: input.voice,
        rate: input.rate,
        pitch: input.pitch,
      };
    });
    const runner = createLocalJobRunner({
      databasePath,
      storageRoot,
      tts,
      audio: createFakeAudio(),
      jobConcurrency: 2,
    });
    runners.push(runner);

    const runPromise = runner.runOnce();
    await slowTtsStarted;
    await waitFor(async () => {
      const job = await jobs.findById(second.jobId);
      return job?.stage === "assembling";
    });
    releaseSlowTts?.();
    await expect(runPromise).resolves.toBe(2);
  });

  it("does not let older processing jobs starve a queued job", async () => {
    const databasePath = createTempDatabasePath();
    const storageRoot = path.dirname(databasePath);
    const client = createDatabaseClient(databasePath);
    initializeDatabase(client.db);
    clients.push(client);

    const books = new DrizzleBookRepository(client.db);
    const jobs = new DrizzleJobRepository(client.db);
    const storage = new LocalStorage(storageRoot);
    const oldProcessingA = await createBookJob(
      { books, jobs, storage },
      {
        title: "Old processing A",
        text: "Chapter 1 Start\nThis is body text.",
        voice: "zh-CN-XiaoxiaoNeural",
        rate: "+0%",
        pitch: "+0Hz",
      },
    );
    const oldProcessingB = await createBookJob(
      { books, jobs, storage },
      {
        title: "Old processing B",
        text: "Chapter 1 Start\nThis is body text.",
        voice: "zh-CN-XiaoxiaoNeural",
        rate: "+0%",
        pitch: "+0Hz",
      },
    );
    const queued = await createBookJob(
      { books, jobs, storage },
      {
        title: "Queued worker test",
        text: "Chapter 1 Start\nThis is body text.",
        voice: "zh-CN-XiaoxiaoNeural",
        rate: "+0%",
        pitch: "+0Hz",
      },
    );

    await jobs.updateById(oldProcessingA.jobId, {
      status: "processing",
      stage: "tts",
      progress: 85,
    });
    await jobs.updateById(oldProcessingB.jobId, {
      status: "processing",
      stage: "tts",
      progress: 85,
    });

    const runner = createLocalJobRunner({
      databasePath,
      storageRoot,
      tts: createFakeTts(),
      audio: createFakeAudio(),
      jobConcurrency: 2,
    });
    runners.push(runner);

    await expect(runner.runOnce()).resolves.toBe(2);
    await waitFor(async () => {
      const job = await jobs.findById(queued.jobId);
      return job?.status === "processing" && job.progress === 10;
    });
  });

  it("does not run paused jobs", async () => {
    const databasePath = createTempDatabasePath();
    const storageRoot = path.dirname(databasePath);
    const client = createDatabaseClient(databasePath);
    initializeDatabase(client.db);
    clients.push(client);

    const books = new DrizzleBookRepository(client.db);
    const jobs = new DrizzleJobRepository(client.db);
    const storage = new LocalStorage(storageRoot);
    const result = await createBookJob(
      { books, jobs, storage },
      {
        title: "Paused worker test",
        text: "Chapter 1 Start\nThis is body text.",
        voice: "zh-CN-XiaoxiaoNeural",
        rate: "+0%",
        pitch: "+0Hz",
      },
    );
    await jobs.updateById(result.jobId, {
      status: "paused",
      stage: "tts",
      progress: 85,
    });
    const runner = createLocalJobRunner({
      databasePath,
      storageRoot,
      tts: createFakeTts(),
      audio: createFakeAudio(),
    });
    runners.push(runner);

    await expect(runner.runOnce()).resolves.toBe(0);
    await expect(jobs.findById(result.jobId)).resolves.toMatchObject({
      status: "paused",
      stage: "tts",
      progress: 85,
    });
  });
});

function createFakeTts(
  synthesize?: TTSProvider["synthesize"],
): TTSProvider {
  return {
    async synthesize(input) {
      if (synthesize) {
        return synthesize(input);
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

async function wait(delayMs: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs = 500,
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) {
      return;
    }

    await wait(5);
  }

  throw new Error("Timed out waiting for condition");
}

async function runRunnerUntil(
  runner: LocalJobRunner,
  predicate: () => Promise<boolean>,
  timeoutMs = 1000,
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    await runner.runOnce();
    await wait(10);

    if (await predicate()) {
      return;
    }
  }

  throw new Error("Timed out waiting for runner condition");
}

function createFakeAudio(): AudioAssembler {
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
  };
}
