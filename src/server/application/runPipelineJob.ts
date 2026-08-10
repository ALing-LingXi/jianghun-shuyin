import type { Job } from "@/server/domain/entities";
import type {
  BookRepository,
  JobRepository,
  PartRepository,
} from "@/server/ports/repositories";
import type { FileStorage } from "@/server/ports/storage";
import {
  buildReport,
  cleanText,
  decodeText,
  detectChapters,
  planParts,
} from "@/server/pipeline";

export type RunPipelineJobDeps = {
  books: BookRepository;
  jobs: JobRepository;
  parts: PartRepository;
  storage: FileStorage;
};

const STAGE_PROGRESS = {
  queued: 0,
  processing: 5,
  decoding: 10,
  cleaning: 30,
  chapter_detection: 50,
  planning: 80,
  tts: 90,
  assembling: 95,
  completed: 100,
  failed: 0,
  cancelled: 0,
} as const;

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

export async function runPipelineJob(
  deps: RunPipelineJobDeps,
  jobId: string,
): Promise<void> {
  const job = await deps.jobs.findById(jobId);

  if (!job || TERMINAL_STATUSES.has(job.status)) {
    return;
  }

  try {
    if (job.status === "queued") {
      await deps.jobs.updateById(job.id, {
        status: "processing",
        stage: "decoding",
        progress: STAGE_PROGRESS.decoding,
        errorMessage: null,
      });
      return;
    }

    const book = await deps.books.findById(job.bookId);
    if (!book) {
      await failJob(deps.jobs, job, `Book ${job.bookId} not found`);
      return;
    }

    if (job.stage === "decoding") {
      await decodeStage(deps, job, book.sourcePath);
      return;
    }

    if (job.stage === "cleaning") {
      await cleaningStage(deps, job, book.sourcePath);
      return;
    }

    if (job.stage === "chapter_detection") {
      await chapterDetectionStage(deps, job, book.sourcePath);
      return;
    }

    if (job.stage === "planning") {
      await planningStage(deps, job, book.sourcePath);
      return;
    }

    if (job.stage === "tts" || job.stage === "assembling") {
      await planningStage(deps, job, book.sourcePath);
      return;
    }

    if (job.stage === "completed") {
      await deps.jobs.updateById(job.id, {
        status: "completed",
        progress: STAGE_PROGRESS.completed,
        errorMessage: null,
      });
      return;
    }
  } catch (error) {
    await failJob(deps.jobs, job, toErrorMessage(error));
  }
}

async function decodeStage(
  deps: RunPipelineJobDeps,
  job: Job,
  sourcePath: string,
): Promise<void> {
  const raw = await deps.storage.readTextSource(sourcePath);
  decodeText(raw);

  await deps.jobs.updateById(job.id, {
    stage: "cleaning",
    progress: STAGE_PROGRESS.cleaning,
    errorMessage: null,
  });
}

async function cleaningStage(
  deps: RunPipelineJobDeps,
  job: Job,
  sourcePath: string,
): Promise<void> {
  const raw = await deps.storage.readTextSource(sourcePath);
  const decoded = decodeText(raw);
  const cleaned = cleanText(decoded.text);

  await deps.storage.saveTextSource({
    content: cleaned.text,
    fileName: `${job.id}.cleaned.txt`,
    subdirectory: "cleaned",
  });

  await deps.jobs.updateById(job.id, {
    stage: "chapter_detection",
    progress: STAGE_PROGRESS.chapter_detection,
    errorMessage: null,
  });
}

async function chapterDetectionStage(
  deps: RunPipelineJobDeps,
  job: Job,
  sourcePath: string,
): Promise<void> {
  const raw = await deps.storage.readTextSource(sourcePath);
  const decoded = decodeText(raw);
  const cleaned = cleanText(decoded.text);
  detectChapters(cleaned.text);

  await deps.jobs.updateById(job.id, {
    stage: "planning",
    progress: STAGE_PROGRESS.planning,
    errorMessage: null,
  });
}

async function planningStage(
  deps: RunPipelineJobDeps,
  job: Job,
  sourcePath: string,
): Promise<void> {
  const raw = await deps.storage.readTextSource(sourcePath);
  const decoded = decodeText(raw);
  const cleaned = cleanText(decoded.text);
  const chapters = detectChapters(cleaned.text);
  const plan = planParts(cleaned.text, chapters.chapters);
  const report = buildReport({
    decode: decoded,
    clean: cleaned,
    chapters,
    plan,
  });

  await deps.storage.saveTextSource({
    content: JSON.stringify(
      {
        decode: decoded,
        clean: cleaned,
        chapters,
        plan,
        report,
      },
      null,
      2,
    ),
    fileName: `${job.id}.report.json`,
    subdirectory: "reports",
  });

  for (const plannedPart of plan.parts) {
    await deps.parts.create({
      bookId: job.bookId,
      index: plannedPart.index,
      title: plannedPart.title,
      durationSeconds: plannedPart.estimatedDurationSeconds,
      status: "pending",
    });
  }

  await deps.jobs.updateById(job.id, {
    status: "completed",
    stage: "completed",
    progress: STAGE_PROGRESS.completed,
    errorMessage: null,
  });
}

async function failJob(
  jobs: JobRepository,
  job: Job,
  reason: string,
): Promise<void> {
  await jobs.updateById(job.id, {
    status: "failed",
    stage: job.stage,
    progress: job.progress,
    errorMessage: reason,
  });
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Pipeline failed";
}
