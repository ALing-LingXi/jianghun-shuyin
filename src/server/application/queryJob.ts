import type { Job } from "@/server/domain/entities";
import type {
  JobRepository,
  PartRepository,
} from "@/server/ports/repositories";
import type { JobDto } from "@/shared/schemas/job";

export type QueryJobDeps = {
  jobs: JobRepository;
  parts?: PartRepository;
};

export async function queryJob(
  deps: QueryJobDeps,
  jobId: string,
): Promise<(Job & Pick<JobDto, "parts">) | null> {
  const job = await deps.jobs.findById(jobId);
  if (!job) {
    return null;
  }

  if (!deps.parts) {
    return {
      ...job,
      parts: [],
    };
  }

  const parts = await deps.parts.listByBookId(job.bookId);
  return {
    ...job,
    parts: parts.map((part) => ({
      id: part.id,
      index: part.index,
      title: part.title,
      status: part.status,
      durationSeconds: part.durationSeconds,
    })),
  };
}
