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
  const seekTargetSeconds = usePlayerStore((state) => state.seekTargetSeconds);
  const setPlaying = usePlayerStore((state) => state.setPlaying);
  const setPlaybackTime = usePlayerStore((state) => state.setPlaybackTime);
  const clearSeekTarget = usePlayerStore((state) => state.clearSeekTarget);
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
      setPlaybackTime({ currentTimeSeconds: 0, durationSeconds: null });
      return;
    }

    const nextSrc = new URL(currentPart.audioUrl, window.location.href).href;
    if (audio.src !== nextSrc) {
      audio.src = currentPart.audioUrl;
      audio.load();
      setPlaybackTime({ currentTimeSeconds: 0, durationSeconds: null });
    }
  }, [currentPart, setPlaybackTime]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentPart || seekTargetSeconds === null) {
      return;
    }

    if (Number.isFinite(audio.duration)) {
      audio.currentTime = Math.min(seekTargetSeconds, audio.duration);
    } else {
      audio.currentTime = seekTargetSeconds;
    }

    clearSeekTarget();
  }, [clearSeekTarget, currentPart, seekTargetSeconds]);

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
      onLoadedMetadata={(event) =>
        setPlaybackTime({
          currentTimeSeconds: event.currentTarget.currentTime,
          durationSeconds: Number.isFinite(event.currentTarget.duration)
            ? event.currentTarget.duration
            : null,
        })
      }
      onDurationChange={(event) =>
        setPlaybackTime({
          currentTimeSeconds: event.currentTarget.currentTime,
          durationSeconds: Number.isFinite(event.currentTarget.duration)
            ? event.currentTarget.duration
            : null,
        })
      }
      onTimeUpdate={(event) =>
        setPlaybackTime({
          currentTimeSeconds: event.currentTarget.currentTime,
          durationSeconds: Number.isFinite(event.currentTarget.duration)
            ? event.currentTarget.duration
            : null,
        })
      }
      onEnded={goToNext}
    />
  );
}
