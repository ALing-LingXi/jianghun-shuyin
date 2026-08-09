import type { Job } from "@/server/domain/entities";
import type { JobRepository } from "@/server/ports/repositories";

export type QueryJobDeps = {
  jobs: JobRepository;
};

export async function queryJob(
  deps: QueryJobDeps,
  jobId: string,
): Promise<Job | null> {
  return deps.jobs.findById(jobId);
}
