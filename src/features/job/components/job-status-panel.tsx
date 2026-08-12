"use client";

import { useEffect } from "react";
import type { JobDto } from "@/shared/schemas/job";

export function JobStatusPanel({ job }: { job: JobDto }) {
  useEffect(() => {
    if (job.status === "failed" && job.errorMessage) {
      console.error("[job] pipeline failed", {
        jobId: job.id,
        stage: job.stage,
        progress: job.progress,
        errorMessage: job.errorMessage,
      });
    }
  }, [job]);

  return (
    <dl className="grid gap-4 rounded border border-stone-200 bg-white p-6">
      <div>
        <dt className="text-sm text-stone-500">Status</dt>
        <dd className="mt-1 text-lg font-semibold text-stone-900">
          {job.status}
        </dd>
      </div>
      <div>
        <dt className="text-sm text-stone-500">Stage</dt>
        <dd className="mt-1 text-lg font-semibold text-stone-900">
          {job.stage}
        </dd>
      </div>
      <div>
        <dt className="text-sm text-stone-500">Progress</dt>
        <dd className="mt-1 text-lg font-semibold text-stone-900">
          {job.progress}%
        </dd>
        <div className="mt-3 h-2 overflow-hidden rounded bg-stone-100">
          <div
            className="h-full bg-amber-600 transition-all"
            style={{ width: `${job.progress}%` }}
          />
        </div>
      </div>
      {job.errorMessage ? (
        <div>
          <dt className="text-sm text-stone-500">Error</dt>
          <dd className="mt-1 text-sm leading-6 text-red-700">
            {job.errorMessage}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
