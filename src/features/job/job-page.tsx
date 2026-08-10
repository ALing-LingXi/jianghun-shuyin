"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { JobStatusPanel } from "./components/job-status-panel";
import { JobApiError, useJobPolling } from "./hooks/useJobPolling";

function JobPageContent({ jobId }: { jobId: string }) {
  const query = useJobPolling(jobId);

  if (query.isPending) {
    return (
      <p className="text-sm text-stone-600" data-testid="job-loading">
        加载任务中...
      </p>
    );
  }

  if (query.isError) {
    const error = query.error as JobApiError;
    return (
      <div className="grid gap-3" data-testid="job-error">
        <p className="text-sm font-medium text-red-700">
          {error.status === 404 ? "任务不存在" : "任务加载失败"}
        </p>
        <p className="text-sm text-stone-600">{error.message}</p>
      </div>
    );
  }

  return <JobStatusPanel job={query.data} />;
}

export function JobPage({ jobId }: { jobId: string }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <main className="min-h-screen px-6 py-12">
        <section className="mx-auto w-full max-w-3xl border border-stone-300 bg-white/80 p-8 shadow-sm sm:p-10">
          <div className="mb-8">
            <p className="text-sm font-semibold tracking-[0.18em] text-amber-700 uppercase">
              任务
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">
              任务状态
            </h1>
          </div>

          <JobPageContent jobId={jobId} />
        </section>
      </main>
    </QueryClientProvider>
  );
}
