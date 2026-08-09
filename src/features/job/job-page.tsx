"use client";

import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { jobSchema, type JobDto } from "@/shared/schemas/job";

class JobApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "JobApiError";
  }
}

async function fetchJob(jobId: string): Promise<JobDto> {
  const response = await fetch(`/api/jobs/${jobId}`);
  const body = (await response.json().catch(() => null)) as
    | { error?: { code?: string; message?: string } }
    | null;

  if (!response.ok) {
    throw new JobApiError(
      body?.error?.message ?? "Job request failed",
      response.status,
      body?.error?.code,
    );
  }

  return jobSchema.parse(body);
}

function JobPageContent({ jobId }: { jobId: string }) {
  const query = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => fetchJob(jobId),
    retry: false,
  });

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

  return (
    <dl className="grid gap-4 rounded border border-stone-200 bg-white p-6">
      <div>
        <dt className="text-sm text-stone-500">状态</dt>
        <dd className="mt-1 text-lg font-semibold text-stone-900">
          {query.data.status}
        </dd>
      </div>
      <div>
        <dt className="text-sm text-stone-500">阶段</dt>
        <dd className="mt-1 text-lg font-semibold text-stone-900">
          {query.data.stage}
        </dd>
      </div>
      <div>
        <dt className="text-sm text-stone-500">进度</dt>
        <dd className="mt-1 text-lg font-semibold text-stone-900">
          {query.data.progress}%
        </dd>
      </div>
    </dl>
  );
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
