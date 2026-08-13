"use client";

import type { JobDto } from "@/shared/schemas/job";
import {
  canPauseJob,
  canResumeJob,
  useJobGenerationControls,
} from "../hooks/useJobControls";

export function JobGenerationControls({
  job,
  bookId,
}: {
  job: Pick<JobDto, "id" | "status">;
  bookId?: string;
}) {
  const controls = useJobGenerationControls(job.id, bookId);
  const canPause = canPauseJob(job);
  const canResume = canResumeJob(job);
  const canControl = canPause || canResume;
  const action = canResume ? "resume" : "pause";

  if (!canControl) {
    return null;
  }

  return (
    <div className="grid gap-2 border border-stone-200 bg-white p-3">
      <button
        type="button"
        className="w-fit border border-stone-900 bg-stone-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-300"
        disabled={controls.isPending}
        onClick={() => controls.mutate(action)}
      >
        {controls.isPending
          ? "Updating..."
          : canResume
            ? "Resume generation"
            : "Pause generation"}
      </button>
      {controls.isError ? (
        <p className="text-sm text-red-700" role="alert">
          {controls.error.message}
        </p>
      ) : null}
    </div>
  );
}
