"use client";

import { create } from "zustand";
import type { PlayerPartDto } from "@/shared/schemas/player";

type PlayerState = {
  bookId: string | null;
  partId: string | null;
  parts: PlayerPartDto[];
  isPlaying: boolean;
  setBookId: (bookId: string | null) => void;
  setPartId: (partId: string | null) => void;
  setParts: (parts: PlayerPartDto[]) => void;
  setPlaying: (isPlaying: boolean) => void;
  goToPrevious: () => void;
  goToNext: () => void;
};

export const usePlayerStore = create<PlayerState>((set) => ({
  bookId: null,
  partId: null,
  parts: [],
  isPlaying: false,
  setBookId: (bookId) => set({ bookId }),
  setPartId: (partId) => set({ partId }),
  setParts: (parts) =>
    set((state) => ({
      parts,
      partId: parts.some((part) => part.id === state.partId)
        ? state.partId
        : (parts[0]?.id ?? null),
    })),
  setPlaying: (isPlaying) => set({ isPlaying }),
  goToPrevious: () =>
    set((state) => {
      const currentIndex = state.parts.findIndex(
        (part) => part.id === state.partId,
      );
      const nextPart = state.parts[currentIndex - 1];

      return nextPart ? { partId: nextPart.id } : {};
    }),
  goToNext: () =>
    set((state) => {
      const currentIndex = state.parts.findIndex(
        (part) => part.id === state.partId,
      );
      const nextPart = state.parts[currentIndex + 1];

      return nextPart ? { partId: nextPart.id } : { isPlaying: false };
    }),
}));
