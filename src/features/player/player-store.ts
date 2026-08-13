"use client";

import { create } from "zustand";
import type { PlayerPartDto } from "@/shared/schemas/player";

type PlayerState = {
  bookId: string | null;
  partId: string | null;
  parts: PlayerPartDto[];
  isPlaying: boolean;
  currentTimeSeconds: number;
  durationSeconds: number | null;
  seekTargetSeconds: number | null;
  stopAfterCurrent: boolean;
  sleepTimerEndsAt: number | null;
  setBookId: (bookId: string | null) => void;
  setPartId: (partId: string | null) => void;
  setParts: (parts: PlayerPartDto[]) => void;
  setPlaying: (isPlaying: boolean) => void;
  setPlaybackTime: (input: {
    currentTimeSeconds: number;
    durationSeconds: number | null;
  }) => void;
  requestSeek: (seconds: number) => void;
  clearSeekTarget: () => void;
  setStopAfterCurrent: (stopAfterCurrent: boolean) => void;
  setSleepTimerMinutes: (minutes: number) => void;
  clearSleepTimer: () => void;
  goToPrevious: () => void;
  goToNext: () => void;
};

export const usePlayerStore = create<PlayerState>((set) => ({
  bookId: null,
  partId: null,
  parts: [],
  isPlaying: false,
  currentTimeSeconds: 0,
  durationSeconds: null,
  seekTargetSeconds: null,
  stopAfterCurrent: false,
  sleepTimerEndsAt: null,
  setBookId: (bookId) => set({ bookId }),
  setPartId: (partId) =>
    set({
      partId,
      currentTimeSeconds: 0,
      durationSeconds: null,
      seekTargetSeconds: null,
    }),
  setParts: (parts) =>
    set((state) => {
      const nextPartId = parts.some(
        (part) => part.id === state.partId && isPlayablePart(part),
      )
        ? state.partId
        : (parts.find(isPlayablePart)?.id ?? null);

      return {
        parts,
        partId: nextPartId,
        ...(nextPartId === state.partId
          ? {}
          : {
              currentTimeSeconds: 0,
              durationSeconds: null,
              seekTargetSeconds: null,
            }),
      };
    }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setPlaybackTime: ({ currentTimeSeconds, durationSeconds }) =>
    set({
      currentTimeSeconds,
      durationSeconds,
    }),
  requestSeek: (seconds) => set({ seekTargetSeconds: Math.max(0, seconds) }),
  clearSeekTarget: () => set({ seekTargetSeconds: null }),
  setStopAfterCurrent: (stopAfterCurrent) => set({ stopAfterCurrent }),
  setSleepTimerMinutes: (minutes) =>
    set({ sleepTimerEndsAt: Date.now() + minutes * 60_000 }),
  clearSleepTimer: () => set({ sleepTimerEndsAt: null }),
  goToPrevious: () =>
    set((state) => {
      const playableParts = state.parts.filter(isPlayablePart);
      const currentIndex = playableParts.findIndex(
        (part) => part.id === state.partId,
      );
      const nextPart = playableParts[currentIndex - 1];

      return nextPart
        ? {
            partId: nextPart.id,
            currentTimeSeconds: 0,
            durationSeconds: null,
            seekTargetSeconds: null,
          }
        : {};
    }),
  goToNext: () =>
    set((state) => {
      if (state.stopAfterCurrent) {
        return { isPlaying: false, stopAfterCurrent: false };
      }

      const playableParts = state.parts.filter(isPlayablePart);
      const currentIndex = playableParts.findIndex(
        (part) => part.id === state.partId,
      );
      const nextPart = playableParts[currentIndex + 1];

      return nextPart
        ? {
            partId: nextPart.id,
            currentTimeSeconds: 0,
            durationSeconds: null,
            seekTargetSeconds: null,
          }
        : { isPlaying: false };
    }),
}));

function isPlayablePart(part: PlayerPartDto): boolean {
  return part.status === "completed" && Boolean(part.audioUrl);
}
