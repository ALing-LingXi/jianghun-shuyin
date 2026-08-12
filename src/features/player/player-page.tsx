"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AudioPlayer } from "./components/audio-player";
import { PlayerApiError, usePlayerQuery } from "./hooks/usePlayerQuery";
import { usePlayerStore } from "./player-store";

function PlayerPageContent({ bookId }: { bookId: string }) {
  const query = usePlayerQuery(bookId);
  const setBookId = usePlayerStore((state) => state.setBookId);

  useEffect(() => {
    setBookId(bookId);
  }, [bookId, setBookId]);

  if (query.isPending) {
    return <p className="text-sm text-stone-600">Loading playlist...</p>;
  }

  if (query.isError) {
    const error = query.error as PlayerApiError;
    return (
      <div className="grid gap-2 text-sm text-red-700">
        <p>{error.status === 404 ? "Playlist not found" : "Playlist failed to load"}</p>
        <p>{error.message}</p>
      </div>
    );
  }

  if (query.data.parts.length === 0) {
    return <p className="text-sm text-stone-600">No chapters planned yet.</p>;
  }

  return <AudioPlayer player={query.data} />;
}

export function PlayerPage({ bookId }: { bookId: string }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-12">
        <section className="mx-auto grid w-full max-w-3xl gap-8 border border-stone-300 bg-white/80 p-6 shadow-sm sm:p-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-amber-700 uppercase">
                Player
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">
                Audio Player
              </h1>
            </div>
            <Link
              className="border border-stone-300 px-4 py-2 text-sm font-medium text-stone-800"
              href="/books"
            >
              Back to books
            </Link>
          </div>
          <PlayerPageContent bookId={bookId} />
        </section>
      </main>
    </QueryClientProvider>
  );
}
