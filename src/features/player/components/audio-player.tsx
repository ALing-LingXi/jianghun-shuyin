"use client";

import { useEffect, useMemo } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import type { PlayerDto } from "@/shared/schemas/player";
import { usePlayerStore } from "../player-store";

export function AudioPlayer({ player }: { player: PlayerDto }) {
  const partId = usePlayerStore((state) => state.partId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const setPartId = usePlayerStore((state) => state.setPartId);
  const setParts = usePlayerStore((state) => state.setParts);
  const setPlaying = usePlayerStore((state) => state.setPlaying);
  const goToPrevious = usePlayerStore((state) => state.goToPrevious);
  const goToNext = usePlayerStore((state) => state.goToNext);

  const currentIndex = useMemo(() => {
    const index = player.parts.findIndex((part) => part.id === partId);
    return index >= 0 ? index : 0;
  }, [partId, player.parts]);

  const currentPart = player.parts[currentIndex] ?? player.parts[0];
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < player.parts.length - 1;

  useEffect(() => {
    setParts(player.parts);
  }, [player.parts, setParts]);

  useEffect(() => {
    if (currentPart) {
      setPartId(currentPart.id);
    }
  }, [currentPart, setPartId]);

  function togglePlay() {
    setPlaying(!isPlaying);
  }

  return (
    <div className="grid gap-5" data-testid="audio-player">
      <div className="grid gap-2">
        <p className="text-sm text-stone-500">Current part</p>
        <h2 className="text-xl font-semibold text-stone-900" data-testid="current-part-title">
          {currentPart?.title}
        </h2>
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
          className="flex items-center gap-2 border border-stone-900 bg-stone-900 px-3 py-2 text-sm font-medium text-white"
          onClick={togglePlay}
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
      </div>

      <ul className="grid gap-2" data-testid="player-part-list">
        {player.parts.map((part) => (
          <li key={part.id}>
            <button
              type="button"
              data-testid={`player-part-${part.index + 1}`}
              className="w-full border border-stone-200 px-3 py-2 text-left text-sm"
              onClick={() => setPartId(part.id)}
            >
              {part.index + 1}. {part.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
