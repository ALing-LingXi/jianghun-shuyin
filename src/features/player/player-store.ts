"use client";

import { create } from "zustand";
import type { PlayerPartDto } from "@/shared/schemas/player";

type PlayerState = {
  bookId: string | null;
  partId: string | null;
  parts: PlayerPartDto[];
  isPlaying: boolean;
  stopAfterCurrent: boolean;
  sleepTimerEndsAt: number | null;
  setBookId: (bookId: string | null) => void;
  setPartId: (partId: string | null) => void;
  setParts: (parts: PlayerPartDto[]) => void;
  setPlaying: (isPlaying: boolean) => void;
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
  stopAfterCurrent: false,
  sleepTimerEndsAt: null,
  setBookId: (bookId) => set({ bookId }),
  setPartId: (partId) => set({ partId }),
  setParts: (parts) =>
    set((state) => ({
      parts,
      partId: parts.some((part) => part.id === state.partId && isPlayablePart(part))
        ? state.partId
        : (parts.find(isPlayablePart)?.id ?? null),
    })),
  setPlaying: (isPlaying) => set({ isPlaying }),
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

      return nextPart ? { partId: nextPart.id } : {};
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

      return nextPart ? { partId: nextPart.id } : { isPlaying: false };
    }),
}));

function isPlayablePart(part: PlayerPartDto): boolean {
  return part.status === "completed" && Boolean(part.audioUrl);
}
