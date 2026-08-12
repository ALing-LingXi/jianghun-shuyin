"use client";

import { useEffect, useMemo } from "react";
import {
  Clock,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
} from "lucide-react";
import type { PlayerDto, PlayerPartDto } from "@/shared/schemas/player";
import { useRetryPart } from "../hooks/usePlayerQuery";
import { usePlayerStore } from "../player-store";

export function AudioPlayer({ player }: { player: PlayerDto }) {
  const retryPart = useRetryPart(player.bookId);
  const partId = usePlayerStore((state) => state.partId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const stopAfterCurrent = usePlayerStore((state) => state.stopAfterCurrent);
  const sleepTimerEndsAt = usePlayerStore((state) => state.sleepTimerEndsAt);
  const setPartId = usePlayerStore((state) => state.setPartId);
  const setParts = usePlayerStore((state) => state.setParts);
  const setPlaying = usePlayerStore((state) => state.setPlaying);
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
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < playableParts.length - 1;
  const pendingCount = player.parts.filter((part) =>
    ["pending", "processing", "tts", "assembling"].includes(part.status),
  ).length;

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
    <div className="grid gap-5" data-testid="audio-player">
      <div className="grid gap-2">
        <p className="text-sm text-stone-500">Current chapter</p>
        <h2
          className="text-xl font-semibold text-stone-900"
          data-testid="current-part-title"
        >
          {currentPart?.title ?? "No playable chapter yet"}
        </h2>
        <p className="text-sm text-stone-600">
          Playable: {playableParts.length}/{player.parts.length}
          {pendingCount > 0 ? ` - ${pendingCount} generating` : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="player-previous"
          className="flex items-center gap-2 border border-stone-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:text-stone-400"
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
          className="flex items-center gap-2 border border-stone-900 bg-stone-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-stone-200 disabled:text-stone-500"
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
          className="flex items-center gap-2 border border-stone-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:text-stone-400"
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
          className={`flex items-center gap-2 border px-3 py-2 text-sm ${
            stopAfterCurrent
              ? "border-amber-700 bg-amber-50 text-amber-800"
              : "border-stone-300 text-stone-800"
          }`}
          onClick={() => setStopAfterCurrent(!stopAfterCurrent)}
          aria-pressed={stopAfterCurrent}
        >
          <Clock className="h-4 w-4" aria-hidden="true" />
          Stop after chapter
        </button>
      </div>

      <div className="grid gap-2 border border-stone-200 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-stone-800">Sleep timer</span>
          {[10, 15, 30, 45, 60].map((minutes) => (
            <button
              key={minutes}
              type="button"
              className="border border-stone-300 px-2 py-1 text-xs text-stone-800"
              onClick={() => setSleepTimerMinutes(minutes)}
            >
              {minutes}m
            </button>
          ))}
          <button
            type="button"
            className="border border-stone-300 px-2 py-1 text-xs text-stone-800 disabled:cursor-not-allowed disabled:text-stone-400"
            disabled={!sleepTimerEndsAt}
            onClick={clearSleepTimer}
          >
            Clear
          </button>
        </div>
        {sleepTimerEndsAt ? (
          <p className="text-xs text-stone-500">
            Stops at {new Date(sleepTimerEndsAt).toLocaleTimeString()}
          </p>
        ) : null}
      </div>

      <ul className="grid gap-2" data-testid="player-part-list">
        {player.parts.map((part) => (
          <ChapterRow
            key={part.id}
            part={part}
            isRetrying={retryPart.isPending}
            onPlay={() => setPartId(part.id)}
            onRetry={() => void retryPart.mutateAsync(part.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function ChapterRow({
  part,
  isRetrying,
  onPlay,
  onRetry,
}: {
  part: PlayerPartDto;
  isRetrying: boolean;
  onPlay: () => void;
  onRetry: () => void;
}) {
  const isPlayable = isPlayablePart(part);

  return (
    <li className="grid gap-2 border border-stone-200 px-3 py-2 text-sm">
      <button
        type="button"
        data-testid={`player-part-${part.index + 1}`}
        className="text-left disabled:cursor-not-allowed disabled:text-stone-400"
        onClick={onPlay}
        disabled={!isPlayable}
      >
        <span className="font-medium">
          {part.index + 1}. {part.title}
        </span>
        <span className="ml-2 text-xs text-stone-500">
          {statusLabel(part.status)}
        </span>
        {part.errorMessage ? (
          <span className="mt-1 block text-xs leading-5 text-red-700">
            {part.errorMessage}
          </span>
        ) : null}
      </button>
      {part.status === "failed" ? (
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-red-700">
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          <span>Not playable</span>
          <button
            type="button"
            className="border border-red-200 bg-white px-2 py-1 disabled:cursor-not-allowed disabled:text-red-300"
            disabled={isRetrying}
            onClick={onRetry}
          >
            {isRetrying ? "Retrying..." : "Retry chapter"}
          </button>
        </div>
      ) : null}
    </li>
  );
}

function isPlayablePart(part: PlayerPartDto): boolean {
  return part.status === "completed" && Boolean(part.audioUrl);
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
