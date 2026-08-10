import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
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
        title: "三体",
        text: "第一章 开始\n这是正文。",
        voice: "zh-CN-XiaoxiaoNeural",
        rate: "+0%",
        pitch: "+0Hz",
      },
    );
    const runner = createLocalJobRunner({ databasePath, storageRoot });
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
