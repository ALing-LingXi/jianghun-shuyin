"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePlayerStore } from "../player-store";

export function PlayerAudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const parts = usePlayerStore((state) => state.parts);
  const partId = usePlayerStore((state) => state.partId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const setPlaying = usePlayerStore((state) => state.setPlaying);
  const goToNext = usePlayerStore((state) => state.goToNext);

  const currentPart = useMemo(() => {
    return parts.find((part) => part.id === partId) ?? null;
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
