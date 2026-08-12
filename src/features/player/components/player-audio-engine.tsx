"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePlayerStore } from "../player-store";
import type { PlayerPartDto } from "@/shared/schemas/player";

type PlayablePart = PlayerPartDto & {
  audioUrl: string;
};

function isPlayablePart(part: PlayerPartDto | null): part is PlayablePart {
  return part?.status === "completed" && typeof part.audioUrl === "string";
}

export function PlayerAudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const parts = usePlayerStore((state) => state.parts);
  const partId = usePlayerStore((state) => state.partId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const setPlaying = usePlayerStore((state) => state.setPlaying);
  const goToNext = usePlayerStore((state) => state.goToNext);

  const currentPart = useMemo(() => {
    const part = parts.find((candidate) => candidate.id === partId) ?? null;
    return isPlayablePart(part) ? part : null;
  }, [partId, parts]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (!currentPart) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      return;
    }

    const nextSrc = new URL(currentPart.audioUrl, window.location.href).href;
    if (audio.src !== nextSrc) {
      audio.src = currentPart.audioUrl;
      audio.load();
    }
  }, [currentPart]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentPart) {
      return;
    }

    if (isPlaying) {
      void audio.play().catch((error: unknown) => {
        console.error("[player] audio playback failed", error);
        setPlaying(false);
      });
      return;
    }

    audio.pause();
  }, [currentPart, isPlaying, setPlaying]);

  return (
    <audio
      ref={audioRef}
      aria-hidden="true"
      className="hidden"
      data-testid="player-audio-engine"
      preload="metadata"
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={goToNext}
    />
  );
}
