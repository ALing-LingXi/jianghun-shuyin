import { mkdirSync } from "node:fs";
import path from "node:path";
import { asc, inArray } from "drizzle-orm";
import {
  runPipelineJob,
  type RunPipelineJobDeps,
} from "../application/runPipelineJob";
import type { AudioAssembler } from "../ports/audio";
import type { JobRunner } from "../ports/jobRunner";
import type { TTSProvider } from "../ports/tts";
import {
  createDatabaseClient,
  type DatabaseClient,
} from "./db/client";
import { initializeDatabase } from "./db/initialize";
import {
  DrizzleBookRepository,
  DrizzleChunkRepository,
  DrizzleJobRepository,
  DrizzlePartRepository,
} from "./db/repositories";
import { jobs as jobsTable } from "./db/schema";
import { EdgeTtsProvider } from "./edgeTtsProvider";
import { FfmpegAudio } from "./ffmpegAudio";
import { LocalStorage } from "./localStorage";

export type LocalJobRunnerOptions = {
  databasePath?: string;
  storageRoot?: string;
  intervalMs?: number;
  tts?: TTSProvider;
  audio?: AudioAssembler;
};

const DEFAULT_INTERVAL_MS = 1000;
const DEFAULT_STORAGE_ROOT = path.join(process.cwd(), "storage");
const DEFAULT_DATABASE_PATH = path.join(
  DEFAULT_STORAGE_ROOT,
  "jianghun-shuyin.db",
);

export class LocalJobRunner implements JobRunner {
  private timer: ReturnType<typeof setInterval> | null = null;
  private isTicking = false;
  private isStopped = false;

  constructor(
    private readonly client: DatabaseClient,
    private readonly deps: RunPipelineJobDeps,
    private readonly intervalMs = DEFAULT_INTERVAL_MS,
  ) {}

  start(): void {
    if (this.isStopped) {
      return;
    }

    if (this.timer) {
      return;
    }

    void this.runOnce();
    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.intervalMs);
  }

  stop(): void {
    if (this.isStopped) {
      return;
    }

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.client.sqlite.close();
    this.isStopped = true;
  }

  async runOnce(): Promise<number> {
    if (this.isStopped) {
      return 0;
    }

    if (this.isTicking) {
      return 0;
    }

    this.isTicking = true;

    try {
      const activeJobs = this.client.db
        .select({ id: jobsTable.id })
        .from(jobsTable)
        .where(inArray(jobsTable.status, ["queued", "processing"]))
        .orderBy(asc(jobsTable.createdAt))
        .all();
      let updatedCount = 0;

      for (const row of activeJobs) {
        await runPipelineJob(this.deps, row.id);
        updatedCount += 1;
      }

      return updatedCount;
    } finally {
      this.isTicking = false;
    }
  }
}

export function createLocalJobRunner(
  options: LocalJobRunnerOptions = {},
): LocalJobRunner {
  const databasePath = options.databasePath ?? DEFAULT_DATABASE_PATH;
  const storageRoot = options.storageRoot ?? DEFAULT_STORAGE_ROOT;
  mkdirSync(storageRoot, { recursive: true });
  mkdirSync(path.dirname(databasePath), { recursive: true });

  const client = createDatabaseClient(databasePath);
  initializeDatabase(client.db);

  const books = new DrizzleBookRepository(client.db);
  const jobs = new DrizzleJobRepository(client.db);
  const parts = new DrizzlePartRepository(client.db);
  const chunks = new DrizzleChunkRepository(client.db);
  const storage = new LocalStorage(storageRoot);
  const tts = options.tts ?? new EdgeTtsProvider({ storage });
  const audio =
    options.audio ??
    new FfmpegAudio({
      outputDir: path.join(storageRoot, "parts"),
    });

  return new LocalJobRunner(
    client,
    { books, jobs, parts, chunks, storage, tts, audio },
    options.intervalMs ?? DEFAULT_INTERVAL_MS,
  );
}
