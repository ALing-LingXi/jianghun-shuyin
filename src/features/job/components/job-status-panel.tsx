"use client";

import { useEffect } from "react";
import type { JobDto } from "@/shared/schemas/job";
import { JobGenerationControls } from "./job-generation-controls";

export function JobStatusPanel({ job }: { job: JobDto }) {
  useEffect(() => {
    if (job.status === "failed" && job.errorMessage) {
      console.error("[job] pipeline failed", {
        jobId: job.id,
        bookId: job.bookId,
        status: job.status,
        stage: job.stage,
        progress: job.progress,
        errorMessage: job.errorMessage,
        diagnostics: failureDiagnostics(job.stage),
      });
      return;
    }

    if (job.status === "completed_with_errors" && job.errorMessage) {
      console.warn("[job] pipeline completed with chapter errors", {
        jobId: job.id,
        bookId: job.bookId,
        status: job.status,
        stage: job.stage,
        progress: job.progress,
        errorMessage: job.errorMessage,
      });
    }
  }, [job]);

  return (
    <div className="grid gap-5">
      <JobGenerationControls job={job} />

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
            <dd className="mt-3 grid gap-1 border-l-2 border-red-200 pl-3 text-sm leading-6 text-stone-600">
              {failureDiagnostics(job.stage).map((item) => (
                <span key={item}>{item}</span>
              ))}
            </dd>
          </div>
        ) : null}
      </dl>

      <section className="grid gap-3 rounded border border-stone-200 bg-white p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-stone-900">Chapters</h2>
          <p className="text-sm text-stone-500">
            {job.parts.length > 0
              ? `${job.parts.length} planned`
              : "Waiting for chapter detection"}
          </p>
        </div>

        {job.parts.length > 0 ? (
          <ol className="grid gap-2" data-testid="job-chapter-list">
            {job.parts.map((part) => (
              <li
                key={part.id}
                className="flex min-w-0 items-center justify-between gap-3 border border-stone-100 px-3 py-2 text-sm"
              >
                <span
                  className="min-w-0 flex-1 truncate font-medium text-stone-900"
                  title={part.title}
                >
                  {part.index + 1}. {part.title}
                </span>
                <span className="shrink-0 text-xs text-stone-500">
                  {partStatusLabel(part.status)}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-stone-600">
            Chapter titles will appear here after planning starts.
          </p>
        )}
      </section>
    </div>
  );
}

function partStatusLabel(status: JobDto["parts"][number]["status"]): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "tts":
      return "TTS";
    case "assembling":
      return "Assembling";
    case "processing":
      return "Processing";
    case "pending":
      return "Pending";
    case "cancelled":
      return "Cancelled";
  }
}

function failureDiagnostics(stage: JobDto["stage"]): string[] {
  if (stage === "tts") {
    return [
      "查看 worker 终端中的 [tts] 日志，确认每次尝试的异常类型、音色参数和文本长度。",
      "NoAudioReceived 通常表示在线 Edge TTS 没有返回音频，优先检查网络、代理、防火墙或服务临时响应。",
    ];
  }

  if (stage === "assembling") {
    return [
      "查看 worker 终端中的 [worker] 日志，并确认项目内 FFmpeg 与 ffprobe 二进制可执行。",
    ];
  }

  return ["查看 worker 终端中的 [worker] 日志，确认失败阶段和原始错误。"];
}
