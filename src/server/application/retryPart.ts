import type {
  ChunkRepository,
  JobRepository,
  PartRepository,
} from "@/server/ports/repositories";
import type { Part } from "@/server/domain/entities";
import type { FileStorage } from "@/server/ports/storage";

export type RetryPartDeps = {
  jobs: JobRepository;
  parts: PartRepository;
  chunks: ChunkRepository;
  storage: FileStorage;
};

export type RetryPartInput = {
  partId: string;
};

export class RetryPartError extends Error {
  constructor(
    readonly code:
      | "PART_NOT_FOUND"
      | "PART_NOT_FAILED"
      | "PART_RETRY_CONFLICT"
      | "PART_JOB_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "RetryPartError";
  }
}

export async function retryPart(
  deps: RetryPartDeps,
  input: RetryPartInput,
): Promise<Part> {
  const part = await deps.parts.findById(input.partId);
  if (!part) {
    throw new RetryPartError("PART_NOT_FOUND", "Part not found");
  }

  if (["processing", "tts", "assembling"].includes(part.status)) {
    throw new RetryPartError(
      "PART_RETRY_CONFLICT",
      "Part is already being processed",
    );
  }

  if (part.status !== "failed") {
    throw new RetryPartError(
      "PART_NOT_FAILED",
      "Only failed parts can be retried",
    );
  }

  const job = await deps.jobs.findLatestByBookId(part.bookId);
  if (!job) {
    throw new RetryPartError("PART_JOB_NOT_FOUND", "Part job not found");
  }

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

  await deps.chunks.deleteByPartId(part.id);
  const updatedPart = await deps.parts.updateById(part.id, {
    status: "pending",
    audioPath: null,
    durationSeconds: null,
  });
  await deps.jobs.updateById(job.id, {
    status: "processing",
    stage: "tts",
    progress: Math.min(job.progress, 85),
    errorMessage: null,
  });

  return updatedPart ?? part;
}
