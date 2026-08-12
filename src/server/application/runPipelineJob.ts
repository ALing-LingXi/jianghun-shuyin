import type { Job, Part } from "@/server/domain/entities";
import type {
  BookRepository,
  ChunkRepository,
  JobRepository,
  PartRepository,
} from "@/server/ports/repositories";
import type { AudioAssembler } from "@/server/ports/audio";
import type { FileStorage } from "@/server/ports/storage";
import type { TTSProvider } from "@/server/ports/tts";
import {
  buildReport,
  cleanText,
  decodeText,
  detectChapters,
  planParts,
} from "@/server/pipeline";
import { synthesizePartChunks } from "@/server/tts/chunkSynthesis";
import {
  DEFAULT_TTS_PITCH,
  DEFAULT_TTS_RATE,
  DEFAULT_TTS_VOICE,
} from "@/shared/tts";

export type RunPipelineJobDeps = {
  books: BookRepository;
  jobs: JobRepository;
  parts: PartRepository;
  chunks: ChunkRepository;
  storage: FileStorage;
  tts: TTSProvider;
  audio: AudioAssembler;
};

const STAGE_PROGRESS = {
  queued: 0,
  processing: 5,
  decoding: 10,
  cleaning: 30,
  chapter_detection: 50,
  planning: 80,
  tts: 85,
  assembling: 95,
  completed: 100,
  failed: 0,
  cancelled: 0,
} as const;

const TERMINAL_STATUSES = new Set([
  "completed",
  "completed_with_errors",
  "failed",
  "cancelled",
]);

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

    if (job.stage === "tts") {
      await processNextPartStage(deps, job, book.sourcePath);
      return;
    }

    if (job.stage === "assembling") {
      await finalizeJobStage(deps, job);
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
    console.error("[worker] pipeline job failed", {
      jobId: job.id,
      bookId: job.bookId,
      status: job.status,
      stage: job.stage,
      progress: job.progress,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: toErrorMessage(error),
    });
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
  const parsed = await parseSourceText(deps.storage, sourcePath);

  await deps.storage.saveTextSource({
    content: JSON.stringify(
      {
        decode: parsed.decoded,
        clean: parsed.cleaned,
        chapters: parsed.chapters,
        plan: parsed.plan,
        report: parsed.report,
      },
      null,
      2,
    ),
    fileName: `${job.id}.report.json`,
    subdirectory: "reports",
  });

  const existingParts = await deps.parts.listByBookId(job.bookId);
  if (existingParts.length === 0) {
    for (const plannedPart of parsed.plan.parts) {
      await deps.parts.create({
        bookId: job.bookId,
        index: plannedPart.index,
        title: plannedPart.title,
        durationSeconds: plannedPart.estimatedDurationSeconds,
        status: "pending",
      });
    }
  }

  await deps.jobs.updateById(job.id, {
    stage: "tts",
    progress: STAGE_PROGRESS.tts,
    errorMessage: null,
  });
}

async function processNextPartStage(
  deps: RunPipelineJobDeps,
  job: Job,
  sourcePath: string,
): Promise<void> {
  const parsed = await parseSourceText(deps.storage, sourcePath);
  const parts = await deps.parts.listByBookId(job.bookId);

  if (parts.length === 0) {
    throw new Error(`No parts found for book ${job.bookId}`);
  }

  const nextPart = parts.find((part) =>
    ["pending", "processing", "tts", "assembling"].includes(part.status),
  );

  if (!nextPart) {
    await deps.jobs.updateById(job.id, {
      stage: "assembling",
      progress: STAGE_PROGRESS.assembling,
      errorMessage: summarizePartFailures(parts),
    });
    return;
  }

  const plannedPart = parsed.plan.parts.find(
    (candidate) => candidate.index === nextPart.index,
  );
  if (!plannedPart) {
    await markPartFailed(deps, nextPart, `Plan for part ${nextPart.index} not found`);
    await updateJobChapterProgress(deps, job);
    return;
  }

  await clearPartAudioOutputs(deps, nextPart);
  await deps.chunks.deleteByPartId(nextPart.id);
  await deps.parts.updateById(nextPart.id, {
    status: "tts",
    audioPath: null,
    durationSeconds: null,
  });

  const result = await synthesizePartChunks(
    {
      chunks: deps.chunks,
      tts: deps.tts,
    },
    {
      partId: nextPart.id,
      text: plannedPart.text,
      voice: job.voice || DEFAULT_TTS_VOICE,
      rate: job.rate || DEFAULT_TTS_RATE,
      pitch: job.pitch || DEFAULT_TTS_PITCH,
    },
  );

  if (result.failedCount > 0) {
    const failedChunks = await deps.chunks.listByPartId(nextPart.id);
    const failedChunk = failedChunks.find(
      (chunk) => chunk.status === "failed" && chunk.errorMessage,
    );
    await markPartFailed(
      deps,
      nextPart,
      failedChunk?.errorMessage ?? `TTS failed for part ${nextPart.index}`,
    );
    await updateJobChapterProgress(deps, job);
    return;
  }

  await deps.parts.updateById(nextPart.id, { status: "assembling" });

  try {
    await assemblePart(deps, nextPart);
  } catch (error) {
    await markPartFailed(deps, nextPart, toErrorMessage(error));
  }

  await updateJobChapterProgress(deps, job);
}

async function finalizeJobStage(
  deps: RunPipelineJobDeps,
  job: Job,
): Promise<void> {
  const parts = await deps.parts.listByBookId(job.bookId);

  if (parts.length === 0) {
    throw new Error(`No parts found for book ${job.bookId}`);
  }

  const failedParts = parts.filter((part) => part.status === "failed");

  await deps.jobs.updateById(job.id, {
    status: failedParts.length > 0 ? "completed_with_errors" : "completed",
    stage: "completed",
    progress: STAGE_PROGRESS.completed,
    errorMessage:
      failedParts.length > 0
        ? `${failedParts.length} chapter(s) failed. Playable chapters are still available.`
        : null,
  });
}

async function updateJobChapterProgress(
  deps: RunPipelineJobDeps,
  job: Job,
): Promise<void> {
  const parts = await deps.parts.listByBookId(job.bookId);
  const settledCount = parts.filter((part) =>
    ["completed", "failed", "cancelled"].includes(part.status),
  ).length;
  const progress =
    parts.length === 0
      ? STAGE_PROGRESS.tts
      : Math.min(
          STAGE_PROGRESS.assembling,
          STAGE_PROGRESS.tts +
            Math.floor(
              ((STAGE_PROGRESS.assembling - STAGE_PROGRESS.tts) * settledCount) /
                parts.length,
            ),
        );

  if (settledCount >= parts.length) {
    await deps.jobs.updateById(job.id, {
      stage: "assembling",
      progress: STAGE_PROGRESS.assembling,
      errorMessage: summarizePartFailures(parts),
    });
    return;
  }

  await deps.jobs.updateById(job.id, {
    stage: "tts",
    progress,
    errorMessage: summarizePartFailures(parts),
  });
}

async function markPartFailed(
  deps: RunPipelineJobDeps,
  part: Part,
  reason: string,
): Promise<void> {
  await clearPartAudioOutputs(deps, part);
  await deps.parts.updateById(part.id, {
    status: "failed",
    audioPath: null,
    durationSeconds: null,
  });
  console.error("[worker] part failed", {
    bookId: part.bookId,
    partId: part.id,
    partIndex: part.index,
    title: part.title,
    errorMessage: reason,
  });
}

async function clearPartAudioOutputs(
  deps: RunPipelineJobDeps,
  part: Part,
): Promise<void> {
  const chunks = await deps.chunks.listByPartId(part.id);

  await Promise.all(
    chunks
      .map((chunk) => chunk.audioPath)
      .filter((audioPath): audioPath is string => Boolean(audioPath))
      .map((audioPath) => deps.storage.deleteFile(audioPath)),
  );

  if (part.audioPath) {
    await deps.storage.deleteFile(part.audioPath);
  }

  await Promise.all(
    chunks.map((chunk) =>
      deps.chunks.updateById(chunk.id, {
        audioPath: null,
      }),
    ),
  );
}

function summarizePartFailures(parts: Part[]): string | null {
  const failedCount = parts.filter((part) => part.status === "failed").length;
  return failedCount > 0 ? `${failedCount} chapter(s) failed.` : null;
}

async function assemblePart(
  deps: RunPipelineJobDeps,
  part: Part,
): Promise<void> {
  const chunks = await deps.chunks.listByPartId(part.id);

  if (chunks.length === 0) {
    throw new Error(`Part ${part.index} has no chunks to assemble`);
  }

  const incompleteChunk = chunks.find(
    (chunk) => chunk.status !== "completed" || !chunk.audioPath,
  );
  if (incompleteChunk) {
    throw new Error(`Part ${part.index} has incomplete chunk ${incompleteChunk.id}`);
  }

  const assembled = await deps.audio.assemblePart({
    partId: part.id,
    chunkAudioPaths: chunks.map((chunk) => chunk.audioPath!),
    fileName: `${part.id}.mp3`,
  });

  await deps.parts.updateById(part.id, {
    audioPath: assembled.audioPath,
    durationSeconds: assembled.durationSeconds,
    status: "completed",
  });
}

async function parseSourceText(
  storage: FileStorage,
  sourcePath: string,
): Promise<{
  decoded: ReturnType<typeof decodeText>;
  cleaned: ReturnType<typeof cleanText>;
  chapters: ReturnType<typeof detectChapters>;
  plan: ReturnType<typeof planParts>;
  report: ReturnType<typeof buildReport>;
}> {
  const raw = await storage.readTextSource(sourcePath);
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

  return {
    decoded,
    cleaned,
    chapters,
    plan,
    report,
  };
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
