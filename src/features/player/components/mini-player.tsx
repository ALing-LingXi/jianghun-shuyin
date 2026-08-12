"use client";

import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useMemo } from "react";
import type { PlayerPartDto } from "@/shared/schemas/player";
import { usePlayerStore } from "../player-store";

export function MiniPlayer() {
  const parts = usePlayerStore((state) => state.parts);
  const partId = usePlayerStore((state) => state.partId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const setPlaying = usePlayerStore((state) => state.setPlaying);
  const goToPrevious = usePlayerStore((state) => state.goToPrevious);
  const goToNext = usePlayerStore((state) => state.goToNext);
  const playableParts = useMemo(() => parts.filter(isPlayablePart), [parts]);

  const currentIndex = useMemo(() => {
    const index = playableParts.findIndex((part) => part.id === partId);
    return index >= 0 ? index : 0;
  }, [partId, playableParts]);
  const currentPart = playableParts[currentIndex];
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < playableParts.length - 1;

  if (!currentPart) {
    return null;
  }

  function togglePlay() {
    setPlaying(!isPlaying);
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-300 bg-white/95 px-4 py-3 shadow-lg sm:hidden"
      data-testid="mini-player"
    >
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-medium text-stone-900"
            data-testid="mini-current-part-title"
          >
            {currentPart.title}
          </p>
          <p className="text-xs text-stone-500">Chapter {currentPart.index + 1}</p>
        </div>
        <button
          type="button"
          data-testid="mini-player-previous"
          className="grid h-10 w-10 place-items-center border border-stone-300 text-stone-800 disabled:cursor-not-allowed disabled:text-stone-400"
          onClick={goToPrevious}
          disabled={!canGoPrevious}
          aria-label="Previous part"
        >
          <SkipBack className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          data-testid="mini-player-toggle"
          className="grid h-11 w-11 place-items-center border border-stone-900 bg-stone-900 text-white"
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Play className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          data-testid="mini-player-next"
          className="grid h-10 w-10 place-items-center border border-stone-300 text-stone-800 disabled:cursor-not-allowed disabled:text-stone-400"
          onClick={goToNext}
          disabled={!canGoNext}
          aria-label="Next part"
        >
          <SkipForward className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function isPlayablePart(part: PlayerPartDto): boolean {
  return part.status === "completed" && Boolean(part.audioUrl);
}
