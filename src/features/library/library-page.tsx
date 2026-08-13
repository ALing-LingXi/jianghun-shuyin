"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BookOpen,
  CircleAlert,
  Headphones,
  Library,
  ListMusic,
  LoaderCircle,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { LibraryBookDto } from "@/shared/schemas/library";
import {
  LibraryApiError,
  useDeleteLibraryBook,
  useLibraryQuery,
} from "./hooks/useLibraryQuery";

function LibraryPageContent() {
  const query = useLibraryQuery();

  if (query.isPending) {
    return (
      <div className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.06] p-6 text-sm text-stone-300 shadow-2xl shadow-black/20">
        <div className="flex items-center gap-3">
          <LoaderCircle
            className="h-5 w-5 animate-spin text-red-300"
            aria-hidden="true"
          />
          <p className="font-medium text-stone-100">Loading library...</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3" aria-hidden="true">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-32 rounded-lg border border-white/10 bg-white/[0.04]"
            />
          ))}
        </div>
      </div>
    );
  }

  if (query.isError) {
    const error = query.error as LibraryApiError;
    return (
      <div className="grid gap-4 rounded-lg border border-red-300/30 bg-red-950/40 p-6 text-sm shadow-2xl shadow-black/20">
        <div className="flex items-center gap-3">
          <CircleAlert className="h-5 w-5 text-red-300" aria-hidden="true" />
          <p className="font-medium text-red-100">Library failed to load</p>
        </div>
        <p className="text-red-200">{error.message}</p>
        <button
          type="button"
          className="flex w-fit items-center gap-2 rounded-lg border border-red-200/30 bg-white/10 px-3 py-2 font-medium text-red-50 transition hover:bg-white/15"
          onClick={() => void query.refetch()}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  }

  if (query.data.books.length === 0) {
    return (
      <div className="grid gap-5 rounded-lg border border-white/10 bg-white/[0.06] p-8 text-sm text-stone-300 shadow-2xl shadow-black/20">
        <div className="grid h-16 w-16 place-items-center rounded-lg border border-red-300/20 bg-red-500/10 text-red-200">
          <Library className="h-7 w-7" aria-hidden="true" />
        </div>
        <div className="grid gap-2">
          <p className="text-xl font-semibold text-stone-50">No books yet</p>
          <p>
            Create a text upload to start building your local audiobook library.
          </p>
        </div>
        <Link
          className="w-fit rounded-lg border border-red-300/30 bg-red-500 px-4 py-2 font-medium text-white shadow-lg shadow-red-950/30 transition hover:bg-red-400"
          href="/upload"
        >
          Upload text
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {query.data.books.map((book) => (
        <LibraryBookCard key={book.id} book={book} />
      ))}
    </ul>
  );
}

function LibraryBookCard({ book }: { book: LibraryBookDto }) {
  const canPlay = book.playablePartCount > 0;
  const latestJob = book.latestJob;
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const deleteBook = useDeleteLibraryBook();
  const isDeleting = deleteBook.isPending;

  async function handleDelete() {
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      deleteBook.reset();
      return;
    }

    await deleteBook.mutateAsync(book.id).catch(() => undefined);
  }

  return (
    <li className="grid min-w-0 gap-5 rounded-lg border border-white/10 bg-white/[0.07] p-4 shadow-2xl shadow-black/15 ring-1 ring-white/[0.03] transition hover:border-red-300/30 hover:bg-white/[0.09] sm:p-5">
      <div className="grid min-w-0 gap-4 sm:grid-cols-[5rem_1fr]">
        <div className="relative h-24 w-20 overflow-hidden rounded-lg border border-red-200/20 bg-gradient-to-br from-red-500 via-stone-900 to-black shadow-xl shadow-black/30">
          <div className="absolute inset-y-3 left-3 w-px bg-white/20" />
          <div className="absolute right-3 bottom-3 left-5 h-8 rounded bg-white/10" />
          <BookOpen
            className="absolute top-4 right-4 h-5 w-5 text-red-100"
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <StatusPill status={book.status} />
            {latestJob ? <JobPill status={latestJob.status} /> : null}
          </div>
          <h2 className="mt-3 truncate text-lg font-semibold text-stone-50">
            {book.title}
          </h2>
          <p className="mt-1 truncate text-sm text-stone-400">
            {book.author ?? "Unknown author"} - Created{" "}
            {new Date(book.createdAt).toLocaleString("zh-CN")}
          </p>

          <div className="mt-4 grid gap-2 text-sm text-stone-300 sm:grid-cols-3">
            <Metric
              label="Playable"
              value={`${book.playablePartCount}/${book.partCount}`}
            />
            <Metric label="Duration" value={formatDuration(book.durationSeconds)} />
            <Metric
              label="Progress"
              value={latestJob ? `${latestJob.progress}%` : "No job"}
            />
          </div>

          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-red-400"
              style={{ width: `${completionPercent(book)}%` }}
              aria-hidden="true"
            />
          </div>

          {latestJob ? (
            <p className="mt-3 text-sm text-stone-400">
              Latest job: {latestJob.status} - {latestJob.stage} -{" "}
              {latestJob.progress}%
            </p>
          ) : null}
          {deleteBook.isError ? (
            <p className="mt-3 text-sm font-medium text-red-200" role="alert">
              Delete failed: {deleteBook.error.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          aria-disabled={!canPlay}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
            canPlay
              ? "border-red-300/30 bg-red-500 text-white shadow-lg shadow-red-950/30 hover:bg-red-400"
              : "pointer-events-none border-white/10 text-stone-500"
          }`}
          href={`/books/${book.id}/player`}
        >
          <Headphones className="h-4 w-4" aria-hidden="true" />
          Play
        </Link>
        {latestJob ? (
          <Link
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-stone-100 transition hover:bg-white/[0.08]"
            href={`/jobs/${latestJob.id}`}
          >
            <ListMusic className="h-4 w-4" aria-hidden="true" />
            Task
          </Link>
        ) : null}
        <button
          type="button"
          aria-label={
            isConfirmingDelete
              ? `Confirm deletion of ${book.title}`
              : `Delete ${book.title}`
          }
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
            isConfirmingDelete
              ? "border-red-400/40 bg-red-500 text-white"
              : "border-white/10 bg-white/[0.04] text-stone-200 hover:bg-white/[0.08]"
          } disabled:cursor-not-allowed disabled:border-white/10 disabled:text-stone-500`}
          disabled={isDeleting}
          onClick={() => void handleDelete()}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {isDeleting
            ? "Deleting..."
            : isConfirmingDelete
              ? "Confirm delete"
              : "Delete"}
        </button>
        {isConfirmingDelete ? (
          <button
            type="button"
            aria-label={`Cancel deletion of ${book.title}`}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-stone-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:text-stone-500"
            disabled={isDeleting}
            onClick={() => {
              setIsConfirmingDelete(false);
              deleteBook.reset();
            }}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Cancel
          </button>
        ) : null}
      </div>
    </li>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <span className="block text-xs text-stone-500">{label}</span>
      <span className="mt-1 block truncate font-medium text-stone-100">
        {value}
      </span>
    </span>
  );
}

function StatusPill({ status }: { status: LibraryBookDto["status"] }) {
  const tone = {
    completed: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
    failed: "border-red-300/30 bg-red-400/10 text-red-100",
    processing: "border-amber-300/30 bg-amber-400/10 text-amber-100",
    pending: "border-stone-300/20 bg-white/10 text-stone-200",
  }[status];

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}>
      {status}
    </span>
  );
}

function JobPill({
  status,
}: {
  status: NonNullable<LibraryBookDto["latestJob"]>["status"];
}) {
  const icon =
    status === "paused" ? (
      <PauseCircle className="h-3.5 w-3.5" aria-hidden="true" />
    ) : status === "processing" || status === "queued" ? (
      <LoaderCircle className="h-3.5 w-3.5" aria-hidden="true" />
    ) : status === "failed" ? (
      <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
    ) : (
      <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
    );

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-stone-200">
      {icon}
      {status}
    </span>
  );
}

function completionPercent(book: LibraryBookDto) {
  if (book.partCount <= 0) {
    return 0;
  }

  return Math.min(
    100,
    Math.round((book.playablePartCount / book.partCount) * 100),
  );
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

export function LibraryPage() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <main className="min-h-screen bg-[#151312] px-4 py-8 text-stone-100 sm:px-6 sm:py-12">
        <section className="mx-auto grid w-full max-w-6xl gap-8 pb-24 sm:pb-0">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-[0.18em] text-red-300 uppercase">
                Library
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-50">
                Books
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-400">
                Your local audiobook shelf, ready for generated chapters and
                late-night listening.
              </p>
            </div>
            <Link
              className="rounded-lg border border-red-300/30 bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-red-950/30 transition hover:bg-red-400"
              href="/upload"
            >
              Upload text
            </Link>
          </div>

          <LibraryPageContent />
        </section>
      </main>
    </QueryClientProvider>
  );
}
