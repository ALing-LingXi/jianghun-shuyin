"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BookOpen,
  Headphones,
  ListMusic,
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
      <div className="border border-stone-200 bg-white p-6 text-sm text-stone-600">
        Loading library...
      </div>
    );
  }

  if (query.isError) {
    const error = query.error as LibraryApiError;
    return (
      <div className="grid gap-3 border border-red-200 bg-red-50 p-6 text-sm">
        <p className="font-medium text-red-800">Library failed to load</p>
        <p className="text-red-700">{error.message}</p>
        <button
          type="button"
          className="flex w-fit items-center gap-2 border border-red-300 bg-white px-3 py-2 font-medium text-red-800"
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
      <div className="grid gap-4 border border-stone-200 bg-white p-6 text-sm text-stone-600">
        <p className="font-medium text-stone-900">No books yet</p>
        <p>Create a text upload to start building your local audiobook library.</p>
        <Link
          className="w-fit border border-stone-900 bg-stone-900 px-4 py-2 font-medium text-white"
          href="/upload"
        >
          Upload text
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid gap-4">
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
    <li className="grid gap-5 border border-stone-200 bg-white p-5 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <BookOpen className="h-4 w-4 text-amber-700" aria-hidden="true" />
          <h2 className="truncate text-lg font-semibold text-stone-900">
            {book.title}
          </h2>
        </div>
        <p className="mt-1 text-sm text-stone-500">
          {book.author ?? "Unknown author"} · Created{" "}
          {new Date(book.createdAt).toLocaleString("zh-CN")}
        </p>
        <div className="mt-4 grid gap-2 text-sm text-stone-600 sm:grid-cols-3">
          <span>Status: {book.status}</span>
          <span>
            Parts: {book.playablePartCount}/{book.partCount}
          </span>
          <span>Duration: {formatDuration(book.durationSeconds)}</span>
        </div>
        {latestJob ? (
          <p className="mt-3 text-sm text-stone-600">
            Latest job: {latestJob.status} · {latestJob.stage} ·{" "}
            {latestJob.progress}%
          </p>
        ) : null}
        {deleteBook.isError ? (
          <p className="mt-3 text-sm font-medium text-red-700">
            Delete failed: {deleteBook.error.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 sm:justify-end">
        {latestJob ? (
          <Link
            className="flex items-center gap-2 border border-stone-300 px-3 py-2 text-sm font-medium text-stone-800"
            href={`/jobs/${latestJob.id}`}
          >
            <ListMusic className="h-4 w-4" aria-hidden="true" />
            Task
          </Link>
        ) : null}
        <Link
          aria-disabled={!canPlay}
          className={`flex items-center gap-2 border px-3 py-2 text-sm font-medium ${
            canPlay
              ? "border-stone-900 bg-stone-900 text-white"
              : "pointer-events-none border-stone-200 text-stone-400"
          }`}
          href={`/books/${book.id}/player`}
        >
          <Headphones className="h-4 w-4" aria-hidden="true" />
          Play
        </Link>
        <button
          type="button"
          className={`flex items-center gap-2 border px-3 py-2 text-sm font-medium ${
            isConfirmingDelete
              ? "border-red-700 bg-red-700 text-white"
              : "border-stone-300 text-stone-800"
          } disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-400`}
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
            className="flex items-center gap-2 border border-stone-300 px-3 py-2 text-sm font-medium text-stone-800 disabled:cursor-not-allowed disabled:text-stone-400"
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
      <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-12">
        <section className="mx-auto grid w-full max-w-5xl gap-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-amber-700 uppercase">
                Library
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">
                Books
              </h1>
            </div>
            <Link
              className="border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-medium text-white"
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
