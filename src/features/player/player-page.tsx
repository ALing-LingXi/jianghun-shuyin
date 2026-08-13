"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleAlert, Headphones, Library, LoaderCircle } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DemonPageHeader } from "@/features/ui/demon-page-header";
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
      <div className="demon-panel flex items-center gap-3 p-5 text-sm text-fuchsia-100/70">
        <LoaderCircle className="size-5 animate-spin text-fuchsia-300" />
        <p>Loading playlist...</p>
      </div>
    );
  }

  if (query.isError) {
    const error = query.error as PlayerApiError;
    return (
      <div className="demon-panel grid gap-2 border-red-300/30 p-5 text-sm text-red-100">
        <div className="flex items-center gap-2 font-medium">
          <CircleAlert className="size-5" aria-hidden="true" />
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
      <p className="demon-panel p-5 text-sm text-fuchsia-100/65">
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
      <main className="demon-page">
        <section className="demon-page-inner grid gap-5 pb-24 sm:pb-0">
          <DemonPageHeader
            eyebrow="Audio Shrine"
            title="Audio Player"
            description="已完成章节即时可听，失败章节保留在队列中并支持单章重试。"
            icon={Headphones}
            actions={
              <Link className="demon-button-secondary" href="/books">
                <Library className="size-4" aria-hidden="true" />
                Back to books
              </Link>
            }
          />
          <PlayerPageContent bookId={bookId} />
        </section>
      </main>
    </QueryClientProvider>
  );
}
