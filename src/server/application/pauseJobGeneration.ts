import type { Job } from "@/server/domain/entities";
import type { JobRepository } from "@/server/ports/repositories";

export type PauseJobGenerationDeps = {
  jobs: JobRepository;
};

export type PauseJobGenerationInput = {
  jobId: string;
};

export class PauseJobGenerationError extends Error {
  constructor(
    readonly code: "JOB_NOT_FOUND" | "JOB_NOT_PAUSABLE",
    message: string,
  ) {
    super(message);
    this.name = "PauseJobGenerationError";
  }
}

const PAUSABLE_STATUSES = new Set<Job["status"]>(["queued", "processing"]);

export async function pauseJobGeneration(
  deps: PauseJobGenerationDeps,
  input: PauseJobGenerationInput,
): Promise<Job> {
  const job = await deps.jobs.findById(input.jobId);
  if (!job) {
    throw new PauseJobGenerationError("JOB_NOT_FOUND", "Job not found");
  }

  if (!PAUSABLE_STATUSES.has(job.status)) {
    throw new PauseJobGenerationError(
      "JOB_NOT_PAUSABLE",
      "Only queued or processing jobs can be paused",
    );
  }

  const updated = await deps.jobs.updateById(job.id, {
    status: "paused",
    errorMessage: null,
  });

  return updated ?? job;
}
