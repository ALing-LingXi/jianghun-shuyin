"use client";

import { useEffect } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  LoaderCircle,
  PauseCircle,
} from "lucide-react";
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

  const completedParts = job.parts.filter(
    (part) => part.status === "completed",
  ).length;
  const failedParts = job.parts.filter((part) => part.status === "failed").length;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.75fr)_minmax(24rem,1.25fr)]">
      <section className="demon-panel grid content-start gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="demon-eyebrow">Current Ritual</p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              {jobStatusLabel(job.status)}
            </h2>
            <p className="mt-1 text-sm text-fuchsia-100/55">
              当前阶段：{stageLabel(job.stage)}
            </p>
          </div>
          <JobGenerationControls job={job} />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <JobMetric label="进度" value={`${job.progress}%`} />
          <JobMetric label="已完成" value={`${completedParts}`} />
          <JobMetric label="失败" value={`${failedParts}`} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-fuchsia-100/55">
            <span>{stageLabel(job.stage)}</span>
            <span>{job.progress}%</span>
          </div>
          <div className="h-3 overflow-hidden border border-fuchsia-200/15 bg-black/35 p-0.5">
            <div
              className="h-full bg-fuchsia-400 shadow-[0_0_18px_rgba(244,58,173,0.75)] transition-all"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        </div>

        {job.errorMessage ? (
          <div className="grid gap-3 border border-red-300/25 bg-red-950/35 p-4">
            <div className="flex items-center gap-2 font-bold text-red-100">
              <CircleAlert className="size-4" aria-hidden="true" />
              诊断信息
            </div>
            <p className="text-sm leading-6 text-red-100">
              {job.errorMessage}
            </p>
            <div className="grid gap-1 border-l-2 border-red-300/30 pl-3 text-xs leading-5 text-fuchsia-100/60">
              {failureDiagnostics(job.stage).map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
        ) : (
          <p className="border border-fuchsia-200/10 bg-black/20 p-3 text-xs leading-5 text-fuchsia-100/55">
            Worker 会在章节边界持续推进。暂停采用软暂停，当前正在执行的小步骤完成后停止进入下一章。
          </p>
        )}
      </section>

      <section className="demon-panel grid min-h-0 gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="demon-eyebrow">Chapter Queue</p>
            <h2 className="mt-2 text-xl font-bold text-white">章节炼制队列</h2>
          </div>
          <p className="text-sm text-fuchsia-100/45">
            {job.parts.length > 0
              ? `${job.parts.length} planned`
              : "Waiting for chapter detection"}
          </p>
        </div>

        {job.parts.length > 0 ? (
          <ol
            className="pretty-scrollbar grid max-h-[34rem] gap-2 overflow-y-auto pr-2"
            data-testid="job-chapter-list"
          >
            {job.parts.map((part) => (
              <li
                key={part.id}
                className="grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 border border-fuchsia-200/10 bg-black/20 px-3 py-2.5 text-sm"
              >
                <span className="grid size-8 place-items-center border border-fuchsia-200/20 bg-fuchsia-500/10 text-xs font-bold text-fuchsia-100">
                  {part.index + 1}
                </span>
                <span
                  className="min-w-0 truncate font-bold text-fuchsia-50"
                  title={part.title}
                >
                  {part.title}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-fuchsia-100/55">
                  <PartStatusIcon status={part.status} />
                  {partStatusLabel(part.status)}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="grid min-h-40 place-items-center border border-dashed border-fuchsia-200/15 text-sm text-fuchsia-100/50">
            Chapter titles will appear here after planning starts.
          </p>
        )}
      </section>
    </div>
  );
}

function JobMetric({ label, value }: { label: string; value: string }) {
  return (
    <span className="border border-fuchsia-200/10 bg-black/25 px-3 py-3">
      <span className="block text-xs text-fuchsia-100/35">{label}</span>
      <span className="mt-1 block text-lg font-bold text-white">{value}</span>
    </span>
  );
}

function PartStatusIcon({ status }: { status: JobDto["parts"][number]["status"] }) {
  if (status === "completed") {
    return <CheckCircle2 className="size-3.5 text-emerald-300" aria-hidden="true" />;
  }

  if (status === "failed") {
    return <CircleAlert className="size-3.5 text-red-300" aria-hidden="true" />;
  }

  if (status === "cancelled") {
    return <PauseCircle className="size-3.5 text-stone-400" aria-hidden="true" />;
  }

  if (status === "pending") {
    return <Clock3 className="size-3.5 text-fuchsia-200/50" aria-hidden="true" />;
  }

  return <LoaderCircle className="size-3.5 text-amber-200" aria-hidden="true" />;
}

function jobStatusLabel(status: JobDto["status"]): string {
  switch (status) {
    case "queued":
      return "等待启动";
    case "processing":
      return "正在生成";
    case "paused":
      return "已暂停";
    case "completed":
      return "全部完成";
    case "completed_with_errors":
      return "部分章节完成";
    case "failed":
      return "任务失败";
    case "cancelled":
      return "任务已取消";
  }
}

function stageLabel(stage: JobDto["stage"]): string {
  switch (stage) {
    case "decoding":
      return "文本解码";
    case "cleaning":
      return "正文清洗";
    case "chapter_detection":
      return "章节识别";
    case "planning":
      return "章节规划";
    case "tts":
      return "语音生成";
    case "assembling":
      return "音频拼接";
    case "completed":
      return "完成";
  }
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
