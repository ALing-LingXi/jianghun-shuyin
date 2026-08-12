"use client";

import { useQuery } from "@tanstack/react-query";
import { jobSchema, type JobDto } from "@/shared/schemas/job";
import type { JobStatus } from "@/shared/types/entities";

export const JOB_POLLING_INTERVAL_MS = 2000;

export class JobApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "JobApiError";
  }
}

export function getJobPollingInterval(status?: JobStatus): number | false {
  if (
    status === "completed" ||
    status === "completed_with_errors" ||
    status === "failed" ||
    status === "cancelled"
  ) {
    return false;
  }

  return JOB_POLLING_INTERVAL_MS;
}

export async function fetchJob(jobId: string): Promise<JobDto> {
  const response = await fetch(`/api/jobs/${jobId}`);
  const body = (await response.json().catch(() => null)) as
    | { error?: { code?: string; message?: string } }
    | null;

  if (!response.ok) {
    console.error("[job] request failed", {
      jobId,
      status: response.status,
      code: body?.error?.code,
      message: body?.error?.message,
    });
    throw new JobApiError(
      body?.error?.message ?? "Job request failed",
      response.status,
      body?.error?.code,
    );
  }

  return jobSchema.parse(body);
}

export function useJobPolling(jobId: string) {
  return useQuery<JobDto, JobApiError>({
    queryKey: ["job", jobId],
    queryFn: () => fetchJob(jobId),
    refetchInterval: (query) => getJobPollingInterval(query.state.data?.status),
    refetchIntervalInBackground: true,
    retry: false,
  });
}
