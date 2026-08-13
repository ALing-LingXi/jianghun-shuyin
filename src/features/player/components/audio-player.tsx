"use client";

import { useEffect, useMemo } from "react";
import Image from "next/image";
import {
  CircleAlert,
  Clock,
  Headphones,
  LoaderCircle,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { JobGenerationControls } from "@/features/job/components/job-generation-controls";
import type { PlayerDto, PlayerPartDto } from "@/shared/schemas/player";
import { useRetryPart } from "../hooks/usePlayerQuery";
import { usePlayerStore } from "../player-store";

const GENERATING_STATUSES = new Set<PlayerPartDto["status"]>([
  "pending",
  "processing",
  "tts",
  "assembling",
]);

export function AudioPlayer({ player }: { player: PlayerDto }) {
  const retryPart = useRetryPart(player.bookId);
  const partId = usePlayerStore((state) => state.partId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const currentTimeSeconds = usePlayerStore(
    (state) => state.currentTimeSeconds,
  );
  const durationSeconds = usePlayerStore((state) => state.durationSeconds);
  const continuousPlayback = usePlayerStore(
    (state) => state.continuousPlayback,
  );
  const stopAfterCurrent = usePlayerStore((state) => state.stopAfterCurrent);
  const sleepTimerEndsAt = usePlayerStore((state) => state.sleepTimerEndsAt);
  const setPartId = usePlayerStore((state) => state.setPartId);
  const setParts = usePlayerStore((state) => state.setParts);
  const setPlaying = usePlayerStore((state) => state.setPlaying);
  const requestSeek = usePlayerStore((state) => state.requestSeek);
  const setContinuousPlayback = usePlayerStore(
    (state) => state.setContinuousPlayback,
  );
  const setStopAfterCurrent = usePlayerStore(
    (state) => state.setStopAfterCurrent,
  );
  const setSleepTimerMinutes = usePlayerStore(
    (state) => state.setSleepTimerMinutes,
  );
  const clearSleepTimer = usePlayerStore((state) => state.clearSleepTimer);
  const goToPrevious = usePlayerStore((state) => state.goToPrevious);
  const goToNext = usePlayerStore((state) => state.goToNext);

  const playableParts = useMemo(
    () => player.parts.filter(isPlayablePart),
    [player.parts],
  );
  const currentIndex = useMemo(() => {
    const index = playableParts.findIndex((part) => part.id === partId);
    return index >= 0 ? index : 0;
  }, [partId, playableParts]);
  const currentPart = playableParts[currentIndex] ?? playableParts[0];
  const displayPart =
    player.parts.find((part) => part.id === partId) ??
    currentPart ??
    player.parts[0];
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < playableParts.length - 1;
  const seekDurationSeconds =
    typeof durationSeconds === "number" &&
    Number.isFinite(durationSeconds) &&
    durationSeconds > 0
      ? durationSeconds
      : null;
  const canSeek = Boolean(currentPart) && seekDurationSeconds !== null;
  const progressMax =
    seekDurationSeconds === null ? 0 : Math.floor(seekDurationSeconds);
  const progressValue = canSeek
    ? Math.min(Math.floor(currentTimeSeconds), progressMax)
    : 0;
  const pendingCount = player.parts.filter((part) =>
    GENERATING_STATUSES.has(part.status),
  ).length;
  const failedCount = player.parts.filter((part) => part.status === "failed")
    .length;
  const completedPercent =
    player.parts.length === 0
      ? 0
      : Math.round((playableParts.length / player.parts.length) * 100);

  useEffect(() => {
    setParts(player.parts);
  }, [player.parts, setParts]);

  useEffect(() => {
    if (currentPart) {
      setPartId(currentPart.id);
    }
  }, [currentPart, setPartId]);

  useEffect(() => {
    if (!sleepTimerEndsAt) {
      return;
    }

    const delayMs = sleepTimerEndsAt - Date.now();
    if (delayMs <= 0) {
      setPlaying(false);
      setStopAfterCurrent(false);
      clearSleepTimer();
      return;
    }

    const timer = window.setTimeout(() => {
      setPlaying(false);
      setStopAfterCurrent(false);
      clearSleepTimer();
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [clearSleepTimer, setPlaying, setStopAfterCurrent, sleepTimerEndsAt]);

  function togglePlay() {
    setPlaying(!isPlaying);
  }

  return (
    <div
      className="demon-panel grid overflow-hidden"
      data-testid="audio-player"
    >
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_28rem]">
        <section className="grid min-w-0 gap-5 border-b border-fuchsia-200/10 bg-black/15 p-5 lg:border-r lg:border-b-0 sm:p-7">
          <div className="grid gap-5 md:grid-cols-[12rem_1fr] md:items-center">
            <div className="relative mx-auto aspect-[4/5] w-full max-w-48 overflow-hidden border-2 border-fuchsia-200/30 bg-[#240018] shadow-[8px_8px_0_#59043b] md:mx-0">
              <Image
                className="object-cover opacity-80 mix-blend-screen"
                src="/assets/images/恶魔勇士/GwGFIM.gif"
                alt=""
                fill
                sizes="192px"
                unoptimized
                loading="lazy"
              />
              <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(242,42,162,0.75),transparent_52%),linear-gradient(180deg,rgba(78,6,53,0.7),#10000b)]" />
              <div className="absolute inset-y-5 left-5 w-px bg-white/20" />
              <div className="absolute right-5 bottom-6 left-8 h-20 rounded-lg bg-white/10" />
              <Headphones
                className="absolute top-6 right-6 size-8 text-fuchsia-100"
                aria-hidden="true"
              />
              <div className="absolute right-5 bottom-5 left-8">
                <p className="truncate text-xs font-medium text-red-100">
                  Chapter {displayPart ? displayPart.index + 1 : "--"}
                </p>
                <p className="mt-1 text-xs text-stone-300">
                  {isPlaying ? "Playing" : "Ready"}
                </p>
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="demon-eyebrow">Current chapter</p>
                {player.latestJob ? (
                  <JobGenerationControls
                    job={player.latestJob}
                    bookId={player.bookId}
                  />
                ) : null}
              </div>
              <h2
                className="mt-2 truncate text-2xl font-bold text-white sm:text-3xl"
                data-testid="current-part-title"
                title={displayPart?.title}
              >
                {displayPart?.title ?? "No chapters planned yet"}
              </h2>
              <p className="mt-3 text-sm text-fuchsia-100/55">
                Playable: {playableParts.length}/{player.parts.length}
                {pendingCount > 0 ? ` - ${pendingCount} generating` : ""}
                {failedCount > 0 ? ` - ${failedCount} failed` : ""}
              </p>

              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                <PlayerMetric label="Completed" value={`${completedPercent}%`} />
                <PlayerMetric label="Queue" value={`${player.parts.length}`} />
                <PlayerMetric
                  label="Duration"
                  value={formatTime(displayPart?.durationSeconds ?? null)}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="min-w-0 bg-[#10000b]/75 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="demon-eyebrow">
                Queue
              </p>
              <h3 className="mt-1 text-lg font-bold text-white">
                Chapters
              </h3>
            </div>
            <span className="border border-fuchsia-200/15 bg-black/30 px-3 py-1 text-xs text-fuchsia-100/60">
              {playableParts.length}/{player.parts.length}
            </span>
          </div>

          <ul
            className="pretty-scrollbar grid max-h-[34rem] gap-2 overflow-y-auto pr-2"
            data-testid="player-part-list"
          >
            {player.parts.map((part) => (
              <ChapterRow
                key={part.id}
                part={part}
                isActive={part.id === displayPart?.id}
                isRetrying={retryPart.isPending}
                onPlay={() => setPartId(part.id)}
                onRetry={() => void retryPart.mutateAsync(part.id)}
              />
            ))}
          </ul>
        </section>
      </div>

      <section className="grid gap-4 border-t-2 border-fuchsia-300/25 bg-[#170011]/95 p-4 sm:p-5">
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3 text-xs text-fuchsia-100/55">
            <span>{formatTime(currentTimeSeconds)}</span>
            <span>{formatTime(durationSeconds)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={progressMax}
            step={1}
            value={progressValue}
            className="w-full accent-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Playback progress"
            data-testid="player-progress"
            disabled={!canSeek}
            onChange={(event) => requestSeek(Number(event.currentTarget.value))}
          />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            data-testid="player-continuous-playback"
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
              continuousPlayback
                ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
                : "border-fuchsia-200/15 bg-white/[0.04] text-fuchsia-50 hover:bg-white/[0.08]"
            }`}
            onClick={() => setContinuousPlayback(!continuousPlayback)}
            aria-pressed={continuousPlayback}
          >
            <Repeat className="h-4 w-4" aria-hidden="true" />
            {continuousPlayback ? "Continuous play" : "Single chapter"}
          </button>
          <button
            type="button"
            data-testid="player-previous"
            className="demon-button-secondary"
            onClick={goToPrevious}
            disabled={!canGoPrevious}
            aria-label="Previous part"
          >
            <SkipBack className="h-4 w-4" aria-hidden="true" />
            Previous
          </button>
          <button
            type="button"
            data-testid="player-toggle"
            className="demon-button-primary px-5 py-2.5"
            onClick={togglePlay}
            disabled={!currentPart}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )}
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            data-testid="player-next"
            className="demon-button-secondary"
            onClick={goToNext}
            disabled={!canGoNext}
            aria-label="Next part"
          >
            <SkipForward className="h-4 w-4" aria-hidden="true" />
            Next
          </button>
          <button
            type="button"
            data-testid="player-stop-after-current"
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
              stopAfterCurrent
                ? "border-amber-300/40 bg-amber-400/15 text-amber-100"
                : "border-fuchsia-200/15 bg-white/[0.04] text-fuchsia-50 hover:bg-white/[0.08]"
            }`}
            onClick={() => setStopAfterCurrent(!stopAfterCurrent)}
            aria-pressed={stopAfterCurrent}
          >
            <Clock className="h-4 w-4" aria-hidden="true" />
            Stop after chapter
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-sm font-bold text-fuchsia-100">
            Sleep timer
          </span>
          {[10, 15, 30, 45, 60].map((minutes) => (
            <button
              key={minutes}
              type="button"
              className="border border-fuchsia-200/15 bg-white/[0.04] px-2 py-1 text-xs text-fuchsia-100 transition hover:bg-white/[0.08]"
              onClick={() => setSleepTimerMinutes(minutes)}
            >
              {minutes}m
            </button>
          ))}
          <button
            type="button"
            className="border border-fuchsia-200/15 bg-white/[0.04] px-2 py-1 text-xs text-fuchsia-100 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:text-stone-500"
            disabled={!sleepTimerEndsAt}
            onClick={clearSleepTimer}
          >
            Clear
          </button>
          {sleepTimerEndsAt ? (
            <span className="basis-full text-center text-xs text-fuchsia-100/50">
              Stops at {new Date(sleepTimerEndsAt).toLocaleTimeString()}
            </span>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function PlayerMetric({ label, value }: { label: string; value: string }) {
  return (
    <span className="border border-fuchsia-200/10 bg-black/25 px-3 py-2">
      <span className="block text-xs text-fuchsia-100/35">{label}</span>
      <span className="mt-1 block truncate font-bold text-fuchsia-50">
        {value}
      </span>
    </span>
  );
}

function ChapterRow({
  part,
  isActive,
  isRetrying,
  onPlay,
  onRetry,
}: {
  part: PlayerPartDto;
  isActive: boolean;
  isRetrying: boolean;
  onPlay: () => void;
  onRetry: () => void;
}) {
  const isPlayable = isPlayablePart(part);

  return (
    <li
      className={`grid min-w-0 gap-2 rounded-lg border px-3 py-2 text-sm transition ${
        isActive
          ? "border-fuchsia-300/40 bg-fuchsia-500/10"
          : "border-fuchsia-200/10 bg-black/15 hover:bg-white/[0.05]"
      }`}
    >
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <button
          type="button"
          data-testid={`player-part-${part.index + 1}`}
          className="min-w-0 text-left disabled:cursor-not-allowed disabled:text-stone-500"
          onClick={onPlay}
          disabled={!isPlayable}
          title={part.title}
        >
          <span className="flex min-w-0 items-center gap-3">
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-xs font-semibold ${
                isPlayable
                  ? "border-fuchsia-300/20 bg-fuchsia-500/10 text-fuchsia-100"
                  : "border-white/10 bg-white/[0.04] text-stone-500"
              }`}
            >
              {part.index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold text-fuchsia-50">
                {part.title}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-fuchsia-100/50">
                <StatusIcon status={part.status} />
                {statusLabel(part.status)}
              </span>
            </span>
          </span>
        </button>

        {part.status === "failed" ? (
          <button
            type="button"
            className="inline-flex w-fit items-center gap-1.5 border border-red-300/35 bg-red-500 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-red-500/30 disabled:text-red-100/50 sm:justify-self-end"
            disabled={isRetrying}
            onClick={onRetry}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {isRetrying ? "Retrying..." : "Retry chapter"}
          </button>
        ) : null}
      </div>

      {part.errorMessage ? (
        <span className="block border border-red-300/20 bg-red-950/30 px-3 py-2 text-xs leading-5 text-red-100">
          {part.errorMessage}
        </span>
      ) : null}

      {part.status === "failed" ? (
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-red-100">
          <CircleAlert className="h-3 w-3" aria-hidden="true" />
          <span>Not playable</span>
        </div>
      ) : null}
    </li>
  );
}

function StatusIcon({ status }: { status: PlayerPartDto["status"] }) {
  if (status === "failed") {
    return <CircleAlert className="h-3 w-3 text-red-300" aria-hidden="true" />;
  }

  if (GENERATING_STATUSES.has(status)) {
    return (
      <LoaderCircle className="h-3 w-3 text-amber-300" aria-hidden="true" />
    );
  }

  if (status === "completed") {
    return <Play className="h-3 w-3 text-emerald-300" aria-hidden="true" />;
  }

  return <Pause className="h-3 w-3 text-stone-500" aria-hidden="true" />;
}

function isPlayablePart(part: PlayerPartDto): boolean {
  return part.status === "completed" && Boolean(part.audioUrl);
}

function formatTime(seconds: number | null): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;

  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function statusLabel(status: PlayerPartDto["status"]): string {
  switch (status) {
    case "completed":
      return "Playable";
    case "failed":
      return "Failed";
    case "tts":
      return "Generating audio";
    case "assembling":
      return "Assembling";
    case "processing":
    case "pending":
      return "Queued";
    case "cancelled":
      return "Cancelled";
  }
}
