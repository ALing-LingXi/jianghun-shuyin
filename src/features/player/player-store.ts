"use client";

import { create } from "zustand";

type PlayerState = {
  bookId: string | null;
  partId: string | null;
  isPlaying: boolean;
  setBookId: (bookId: string | null) => void;
  setPartId: (partId: string | null) => void;
  setPlaying: (isPlaying: boolean) => void;
};

export const usePlayerStore = create<PlayerState>((set) => ({
  bookId: null,
  partId: null,
  isPlaying: false,
  setBookId: (bookId) => set({ bookId }),
  setPartId: (partId) => set({ partId }),
  setPlaying: (isPlaying) => set({ isPlaying }),
}));
