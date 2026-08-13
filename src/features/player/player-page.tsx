"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleAlert, LoaderCircle } from "lucide-react";
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
    return (
      <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.06] p-5 text-sm text-stone-300">
        <LoaderCircle className="h-5 w-5 animate-spin text-red-300" />
        <p>Loading playlist...</p>
      </div>
    );
  }

  if (query.isError) {
    const error = query.error as PlayerApiError;
    return (
      <div className="grid gap-2 rounded-lg border border-red-300/30 bg-red-950/40 p-5 text-sm text-red-100">
        <div className="flex items-center gap-2 font-medium">
          <CircleAlert className="h-5 w-5" aria-hidden="true" />
          <p>
            {error.status === 404
              ? "Playlist not found"
              : "Playlist failed to load"}
          </p>
        </div>
        <p className="text-red-200">{error.message}</p>
      </div>
    );
  }

  if (query.data.parts.length === 0) {
    return (
      <p className="rounded-lg border border-white/10 bg-white/[0.06] p-5 text-sm text-stone-300">
        No chapters planned yet.
      </p>
    );
  }

  return <AudioPlayer player={query.data} />;
}

export function PlayerPage({ bookId }: { bookId: string }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <main className="min-h-screen bg-[#11100f] px-4 py-6 text-stone-100 sm:px-6 sm:py-10">
        <section className="mx-auto grid w-full max-w-7xl gap-6 pb-24 sm:pb-0">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-[0.18em] text-red-300 uppercase">
                Player
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-50">
                Audio Player
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-400">
                A focused audiobook queue for finished chapters, failed retries,
                and generation control.
              </p>
            </div>
            <Link
              className="rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-stone-100 transition hover:bg-white/[0.1]"
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
