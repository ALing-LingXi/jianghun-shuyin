"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CircleAlert,
  Headphones,
  Library,
  LoaderCircle,
  ScrollText,
} from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DemonPageHeader } from "@/features/ui/demon-page-header";
import { JobStatusPanel } from "./components/job-status-panel";
import { JobApiError, useJobPolling } from "./hooks/useJobPolling";

function JobPageContent({ jobId }: { jobId: string }) {
  const query = useJobPolling(jobId);

  if (query.isPending) {
    return (
      <div
        className="demon-panel flex min-h-48 items-center justify-center gap-3 p-6 text-sm text-fuchsia-100/70"
        data-testid="job-loading"
      >
        <LoaderCircle
          className="size-5 animate-spin text-fuchsia-300"
          aria-hidden="true"
        />
        加载任务中...
      </div>
    );
  }

  if (query.isError) {
    const error = query.error as JobApiError;
    return (
      <div
        className="demon-panel grid min-h-48 place-content-center gap-3 border-red-300/35 p-6 text-center"
        data-testid="job-error"
      >
        <CircleAlert className="mx-auto size-7 text-red-300" aria-hidden="true" />
        <p className="font-bold text-red-100">
          {error.status === 404 ? "任务不存在" : "任务加载失败"}
        </p>
        <p className="text-sm text-red-200/75">{error.message}</p>
      </div>
    );
  }

  return <JobStatusPanel job={query.data} />;
}

export function JobPage({ jobId }: { jobId: string }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <main className="demon-page">
        <section className="demon-page-inner grid gap-5">
          <DemonPageHeader
            eyebrow="Soul Process"
            title="任务状态"
            description="追踪章节识别、语音生成与音频拼接。已完成章节会立即进入播放器，无需等待整本结束。"
            icon={ScrollText}
            actions={
              <>
                <Link className="demon-button-secondary" href="/books">
                  <Library className="size-4" aria-hidden="true" />
                  书架
                </Link>
                <Link className="demon-button-primary" href="/books">
                  <Headphones className="size-4" aria-hidden="true" />
                  可听章节
                </Link>
              </>
            }
          />
          <JobPageContent jobId={jobId} />
        </section>
      </main>
    </QueryClientProvider>
  );
}
