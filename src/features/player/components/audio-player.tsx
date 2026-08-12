"use client";

import { useEffect, useMemo, useRef } from "react";
import type { PlayerDto } from "@/shared/schemas/player";
import { usePlayerStore } from "../player-store";

export function AudioPlayer({ player }: { player: PlayerDto }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const partId = usePlayerStore((state) => state.partId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const setPartId = usePlayerStore((state) => state.setPartId);
  const setPlaying = usePlayerStore((state) => state.setPlaying);

  const currentIndex = useMemo(() => {
    const index = player.parts.findIndex((part) => part.id === partId);
    return index >= 0 ? index : 0;
  }, [partId, player.parts]);

  const currentPart = player.parts[currentIndex] ?? player.parts[0];
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < player.parts.length - 1;

  useEffect(() => {
    if (currentPart) {
      setPartId(currentPart.id);
    }
  }, [currentPart, setPartId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentPart) {
      return;
    }

    audio.src = currentPart.audioUrl;
    if (isPlaying) {
      void audio.play().catch(() => setPlaying(false));
    }
  }, [currentPart, isPlaying, setPlaying]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
      void audio.play();
      setPlaying(true);
      return;
    }

    audio.pause();
    setPlaying(false);
  }

  function goToPart(nextIndex: number) {
    const nextPart = player.parts[nextIndex];
    if (!nextPart) {
      return;
    }

    setPartId(nextPart.id);
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <p className="text-sm text-stone-500">Current part</p>
        <h2 className="text-xl font-semibold text-stone-900">
          {currentPart?.title}
        </h2>
      </div>

      <audio
        ref={audioRef}
        className="w-full"
        controls
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          if (canGoNext) {
            goToPart(currentIndex + 1);
            return;
          }

          setPlaying(false);
        }}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="border border-stone-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:text-stone-400"
          onClick={() => goToPart(currentIndex - 1)}
          disabled={!canGoPrevious}
        >
          Previous
        </button>
        <button
          type="button"
          className="border border-stone-900 bg-stone-900 px-3 py-2 text-sm font-medium text-white"
          onClick={togglePlay}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          className="border border-stone-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:text-stone-400"
          onClick={() => goToPart(currentIndex + 1)}
          disabled={!canGoNext}
        >
          Next
        </button>
      </div>

      <ul className="grid gap-2">
        {player.parts.map((part) => (
          <li key={part.id}>
            <button
              type="button"
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
