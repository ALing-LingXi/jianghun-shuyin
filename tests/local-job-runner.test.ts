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
    });
    runners.push(runner);

    await expect(runner.runOnce()).resolves.toBe(1);
    await expect(jobs.findById(result.jobId)).resolves.toMatchObject({
      status: "processing",
      stage: "decoding",
      progress: 10,
    });

    for (let step = 0; step < 6; step += 1) {
      await runner.runOnce();
    }

    await expect(jobs.findById(result.jobId)).resolves.toMatchObject({
      status: "completed",
      stage: "completed",
      progress: 100,
    });
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
