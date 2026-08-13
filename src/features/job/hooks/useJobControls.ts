"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { JobDto } from "@/shared/schemas/job";
import { JobApiError } from "./useJobPolling";

export type JobControlAction = "pause" | "resume";

export function canPauseJob(job: Pick<JobDto, "status">): boolean {
  return job.status === "queued" || job.status === "processing";
}

export function canResumeJob(job: Pick<JobDto, "status">): boolean {
  return job.status === "paused";
}

export async function controlJobGeneration(
  jobId: string,
  action: JobControlAction,
): Promise<void> {
  const response = await fetch(`/api/jobs/${jobId}/${action}`, {
    method: "POST",
  });
  const body = (await response.json().catch(() => null)) as
    | { error?: { code?: string; message?: string } }
    | null;

  if (!response.ok) {
    throw new JobApiError(
      body?.error?.message ?? `Job ${action} request failed`,
      response.status,
      body?.error?.code,
    );
  }
}

export function useJobGenerationControls(jobId: string, bookId?: string) {
  const queryClient = useQueryClient();

  return useMutation<void, JobApiError, JobControlAction>({
    mutationFn: (action) => controlJobGeneration(jobId, action),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["job", jobId] }),
        bookId
          ? queryClient.invalidateQueries({ queryKey: ["player", bookId] })
          : Promise.resolve(),
      ]);
    },
  });
}
