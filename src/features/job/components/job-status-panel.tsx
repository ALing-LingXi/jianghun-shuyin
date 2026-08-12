"use client";

import { useEffect } from "react";
import type { JobDto } from "@/shared/schemas/job";

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
  );
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
