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
    <div className="inline-grid w-fit gap-2">
      <button
        type="button"
        className="w-fit rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-xs font-medium text-stone-100 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:text-stone-500"
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
        <p className="max-w-64 text-xs text-red-200" role="alert">
          {controls.error.message}
        </p>
      ) : null}
    </div>
  );
}
