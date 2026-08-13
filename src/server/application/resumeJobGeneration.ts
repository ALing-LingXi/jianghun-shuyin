import type { Job } from "@/server/domain/entities";
import type {
  JobRepository,
  PartRepository,
} from "@/server/ports/repositories";

export type ResumeJobGenerationDeps = {
  jobs: JobRepository;
  parts: PartRepository;
};

export type ResumeJobGenerationInput = {
  jobId: string;
};

export class ResumeJobGenerationError extends Error {
  constructor(
    readonly code: "JOB_NOT_FOUND" | "JOB_NOT_PAUSED",
    message: string,
  ) {
    super(message);
    this.name = "ResumeJobGenerationError";
  }
}

export async function resumeJobGeneration(
  deps: ResumeJobGenerationDeps,
  input: ResumeJobGenerationInput,
): Promise<Job> {
  const job = await deps.jobs.findById(input.jobId);
  if (!job) {
    throw new ResumeJobGenerationError("JOB_NOT_FOUND", "Job not found");
  }

  if (job.status !== "paused") {
    throw new ResumeJobGenerationError(
      "JOB_NOT_PAUSED",
      "Only paused jobs can be resumed",
    );
  }

  const parts = await deps.parts.listByBookId(job.bookId);
  const hasContinuablePart = parts.some((part) =>
    ["pending", "processing", "tts", "assembling"].includes(part.status),
  );
  const failedParts = parts.filter((part) => part.status === "failed");

  if (parts.length > 0 && !hasContinuablePart) {
    const updated = await deps.jobs.updateById(job.id, {
      status: failedParts.length > 0 ? "completed_with_errors" : "completed",
      stage: "completed",
      progress: 100,
      errorMessage:
        failedParts.length > 0
          ? `${failedParts.length} chapter(s) failed. Playable chapters are still available.`
          : null,
    });

    return updated ?? job;
  }

  const updated = await deps.jobs.updateById(job.id, {
    status: "processing",
    stage: parts.length > 0 ? "tts" : job.stage,
    progress: Math.min(job.progress, parts.length > 0 ? 85 : job.progress),
    errorMessage: null,
  });

  return updated ?? job;
}
