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
import { createLimiter } from "../tts/concurrency";
import {
  DEFAULT_GLOBAL_TTS_CONCURRENCY,
  DEFAULT_TTS_CHUNK_CONCURRENCY,
} from "../tts/chunkSynthesis";
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
  jobConcurrency?: number;
  ttsChunkConcurrency?: number;
  globalTtsConcurrency?: number;
  assembleConcurrency?: number;
  tts?: TTSProvider;
  audio?: AudioAssembler;
};

const DEFAULT_INTERVAL_MS = 1000;
const DEFAULT_JOB_CONCURRENCY = 2;
const DEFAULT_ASSEMBLE_CONCURRENCY = 1;
const DEFAULT_STORAGE_ROOT = path.join(process.cwd(), "storage");
const DEFAULT_DATABASE_PATH = path.join(
  DEFAULT_STORAGE_ROOT,
  "jianghun-shuyin.db",
);

export class LocalJobRunner implements JobRunner {
  private timer: ReturnType<typeof setInterval> | null = null;
  private isTicking = false;
  private isStopped = false;
  private readonly inFlightJobIds = new Set<string>();

  constructor(
    private readonly client: DatabaseClient,
    private readonly deps: RunPipelineJobDeps,
    private readonly intervalMs = DEFAULT_INTERVAL_MS,
    private readonly jobConcurrency = DEFAULT_JOB_CONCURRENCY,
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
      const availableSlots = this.jobConcurrency - this.inFlightJobIds.size;
      if (availableSlots <= 0) {
        return 0;
      }

      const activeJobs = this.client.db
        .select({
          id: jobsTable.id,
          status: jobsTable.status,
          createdAt: jobsTable.createdAt,
        })
        .from(jobsTable)
        .where(inArray(jobsTable.status, ["queued", "processing"]))
        .orderBy(asc(jobsTable.createdAt))
        .all();
      const selectedJobs = activeJobs
        .filter((job) => !this.inFlightJobIds.has(job.id))
        .sort(compareRunnableJobs)
        .slice(0, availableSlots);

      for (const job of selectedJobs) {
        this.inFlightJobIds.add(job.id);
        void this.runJob(job.id);
      }

      return selectedJobs.length;
    } finally {
      this.isTicking = false;
    }
  }

  private async runJob(jobId: string): Promise<void> {
    try {
      await runPipelineJob(this.deps, jobId);
    } catch (error) {
      console.error("[worker] job tick failed", {
        jobId,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : "Job tick failed",
      });
    } finally {
      this.inFlightJobIds.delete(jobId);
    }
  }
}

function compareRunnableJobs(
  left: { status: string; createdAt: Date },
  right: { status: string; createdAt: Date },
): number {
  const leftRank = left.status === "queued" ? 0 : 1;
  const rightRank = right.status === "queued" ? 0 : 1;

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return left.createdAt.getTime() - right.createdAt.getTime();
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
  const ttsLimiter = createLimiter(
    options.globalTtsConcurrency ?? DEFAULT_GLOBAL_TTS_CONCURRENCY,
  );
  const assembleLimiter = createLimiter(
    options.assembleConcurrency ?? DEFAULT_ASSEMBLE_CONCURRENCY,
  );
  const audio =
    options.audio ??
    new FfmpegAudio({
      outputDir: path.join(storageRoot, "parts"),
    });

  return new LocalJobRunner(
    client,
    {
      books,
      jobs,
      parts,
      chunks,
      storage,
      tts,
      audio,
      assembleLimiter,
      ttsLimiter,
      ttsChunkConcurrency:
        options.ttsChunkConcurrency ?? DEFAULT_TTS_CHUNK_CONCURRENCY,
    },
    options.intervalMs ?? DEFAULT_INTERVAL_MS,
    options.jobConcurrency ?? DEFAULT_JOB_CONCURRENCY,
  );
}
