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
} from "@/server/tts/voiceCatalog";

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

    if (job.stage === "tts") {
      await ttsStage(deps, job, book.sourcePath);
      return;
    }

    if (job.stage === "assembling") {
      await assemblingStage(deps, job);
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

  for (const plannedPart of parsed.plan.parts) {
    await deps.parts.create({
      bookId: job.bookId,
      index: plannedPart.index,
      title: plannedPart.title,
      durationSeconds: plannedPart.estimatedDurationSeconds,
      status: "pending",
    });
  }

  await deps.jobs.updateById(job.id, {
    stage: "tts",
    progress: STAGE_PROGRESS.tts,
    errorMessage: null,
  });
}

async function ttsStage(
  deps: RunPipelineJobDeps,
  job: Job,
  sourcePath: string,
): Promise<void> {
  const parsed = await parseSourceText(deps.storage, sourcePath);
  const parts = await deps.parts.listByBookId(job.bookId);

  for (const plannedPart of parsed.plan.parts) {
    const part = parts.find((candidate) => candidate.index === plannedPart.index);
    if (!part) {
      throw new Error(`Part ${plannedPart.index} not found for book ${job.bookId}`);
    }

    await deps.parts.updateById(part.id, {
      status: "processing",
      audioPath: null,
      durationSeconds: null,
    });

    const result = await synthesizePartChunks(
      {
        chunks: deps.chunks,
        tts: deps.tts,
      },
      {
        partId: part.id,
        text: plannedPart.text,
        voice: DEFAULT_TTS_VOICE,
        rate: DEFAULT_TTS_RATE,
        pitch: DEFAULT_TTS_PITCH,
      },
    );

    if (result.failedCount > 0) {
      await deps.parts.updateById(part.id, { status: "failed" });
      throw new Error(`TTS failed for part ${part.index}`);
    }
  }

  await deps.jobs.updateById(job.id, {
    stage: "assembling",
    progress: STAGE_PROGRESS.assembling,
    errorMessage: null,
  });
}

async function assemblingStage(
  deps: RunPipelineJobDeps,
  job: Job,
): Promise<void> {
  const parts = await deps.parts.listByBookId(job.bookId);

  if (parts.length === 0) {
    throw new Error(`No parts found for book ${job.bookId}`);
  }

  for (const part of parts) {
    await assemblePart(deps, part);
  }

  await deps.jobs.updateById(job.id, {
    status: "completed",
    stage: "completed",
    progress: STAGE_PROGRESS.completed,
    errorMessage: null,
  });
}

async function assemblePart(
  deps: RunPipelineJobDeps,
  part: Part,
): Promise<void> {
  await deps.parts.updateById(part.id, { status: "processing" });
  const chunks = await deps.chunks.listByPartId(part.id);

  if (chunks.length === 0) {
    await deps.parts.updateById(part.id, { status: "failed" });
    throw new Error(`Part ${part.index} has no chunks to assemble`);
  }

  const incompleteChunk = chunks.find(
    (chunk) => chunk.status !== "completed" || !chunk.audioPath,
  );
  if (incompleteChunk) {
    await deps.parts.updateById(part.id, { status: "failed" });
    throw new Error(`Part ${part.index} has incomplete chunk ${incompleteChunk.id}`);
  }

  try {
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
  } catch (error) {
    await deps.parts.updateById(part.id, { status: "failed" });
    throw error;
  }
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
