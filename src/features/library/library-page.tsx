"use client";

import Image from "next/image";
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
import { DemonPageHeader } from "@/features/ui/demon-page-header";
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
      <div className="demon-panel grid gap-4 p-6 text-sm text-fuchsia-100/70">
        <div className="flex items-center gap-3">
          <LoaderCircle
            className="size-5 animate-spin text-fuchsia-300"
            aria-hidden="true"
          />
          <p className="font-bold text-white">Loading library...</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2" aria-hidden="true">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-36 border border-fuchsia-200/10 bg-white/[0.04]"
            />
          ))}
        </div>
      </div>
    );
  }

  if (query.isError) {
    const error = query.error as LibraryApiError;
    return (
      <div className="demon-panel grid gap-4 border-red-300/35 p-6 text-sm">
        <div className="flex items-center gap-3">
          <CircleAlert className="size-5 text-red-300" aria-hidden="true" />
          <p className="font-bold text-red-100">Library failed to load</p>
        </div>
        <p className="text-red-200">{error.message}</p>
        <button
          type="button"
          className="demon-button-secondary w-fit"
          onClick={() => void query.refetch()}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  }

  if (query.data.books.length === 0) {
    return (
      <div className="demon-panel grid min-h-80 place-items-center p-8 text-center">
        <div className="grid max-w-md justify-items-center gap-4">
          <div className="grid size-16 place-items-center border border-fuchsia-300/25 bg-fuchsia-500/10 text-fuchsia-200">
            <Library className="size-7" aria-hidden="true" />
          </div>
          <div className="grid gap-2">
            <p className="text-xl font-bold text-white">No books yet</p>
            <p className="text-sm leading-6 text-fuchsia-100/65">
              Create a text upload to start building your local audiobook
              library.
            </p>
          </div>
          <Link className="demon-button-primary" href="/upload">
            Upload text
          </Link>
        </div>
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
    <li className="demon-panel group grid min-w-0 gap-5 p-4 transition hover:border-fuchsia-300/60 sm:p-5">
      <div className="grid min-w-0 gap-4 sm:grid-cols-[5rem_1fr]">
        <div className="relative h-24 w-20 overflow-hidden border-2 border-fuchsia-200/25 bg-[#210019] shadow-[4px_4px_0_#59043b]">
          <Image
            className="object-cover opacity-70 transition duration-300 group-hover:scale-105 group-hover:opacity-90"
            src="/assets/images/恶魔勇士/qS68JI.gif"
            alt=""
            fill
            sizes="80px"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a0012] via-transparent to-transparent" />
          <BookOpen
            className="absolute right-3 bottom-3 size-5 text-fuchsia-100"
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <StatusPill status={book.status} />
            {latestJob ? <JobPill status={latestJob.status} /> : null}
          </div>
          <h2 className="mt-3 truncate text-lg font-bold text-white">
            {book.title}
          </h2>
          <p className="mt-1 truncate text-sm text-fuchsia-100/50">
            {book.author ?? "Unknown author"} ·{" "}
            {new Date(book.createdAt).toLocaleString("zh-CN")}
          </p>

          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            <Metric
              label="Playable"
              value={`${book.playablePartCount}/${book.partCount}`}
            />
            <Metric
              label="Duration"
              value={formatDuration(book.durationSeconds)}
            />
            <Metric
              label="Progress"
              value={latestJob ? `${latestJob.progress}%` : "No job"}
            />
          </div>

          <div className="mt-4 h-1.5 overflow-hidden bg-white/10">
            <div
              className="h-full bg-fuchsia-400 shadow-[0_0_14px_rgba(244,58,173,0.7)]"
              style={{ width: `${completionPercent(book)}%` }}
              aria-hidden="true"
            />
          </div>

          {latestJob ? (
            <p className="mt-3 text-xs text-fuchsia-100/45">
              Latest job: {latestJob.status} · {latestJob.stage} ·{" "}
              {latestJob.progress}%
            </p>
          ) : null}
          {deleteBook.isError ? (
            <p className="mt-3 text-sm font-bold text-red-200" role="alert">
              Delete failed: {deleteBook.error.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          aria-disabled={!canPlay}
          className={
            canPlay
              ? "demon-button-primary"
              : "pointer-events-none inline-flex min-h-10 items-center gap-2 border border-white/10 px-3 text-sm font-bold text-stone-500"
          }
          href={`/books/${book.id}/player`}
        >
          <Headphones className="size-4" aria-hidden="true" />
          Play
        </Link>
        {latestJob ? (
          <Link
            className="demon-button-secondary"
            href={`/jobs/${latestJob.id}`}
          >
            <ListMusic className="size-4" aria-hidden="true" />
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
          className={
            isConfirmingDelete
              ? "demon-button-danger"
              : "demon-button-secondary"
          }
          disabled={isDeleting}
          onClick={() => void handleDelete()}
        >
          <Trash2 className="size-4" aria-hidden="true" />
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
            className="demon-button-secondary"
            disabled={isDeleting}
            onClick={() => {
              setIsConfirmingDelete(false);
              deleteBook.reset();
            }}
          >
            <X className="size-4" aria-hidden="true" />
            Cancel
          </button>
        ) : null}
      </div>
    </li>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="border border-fuchsia-200/10 bg-black/25 px-3 py-2">
      <span className="block text-xs text-fuchsia-100/35">{label}</span>
      <span className="mt-1 block truncate font-bold text-fuchsia-50">
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
    pending: "border-fuchsia-300/20 bg-white/10 text-fuchsia-100",
  }[status];

  return (
    <span className={`border px-2.5 py-1 text-xs font-bold ${tone}`}>
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
      <PauseCircle className="size-3.5" aria-hidden="true" />
    ) : status === "processing" || status === "queued" ? (
      <LoaderCircle className="size-3.5" aria-hidden="true" />
    ) : status === "failed" ? (
      <CircleAlert className="size-3.5" aria-hidden="true" />
    ) : (
      <PlayCircle className="size-3.5" aria-hidden="true" />
    );

  return (
    <span className="inline-flex items-center gap-1.5 border border-fuchsia-200/15 bg-white/[0.06] px-2.5 py-1 text-xs font-bold text-fuchsia-100">
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

  return minutes === 0 ? `${remainingSeconds}s` : `${minutes}m ${remainingSeconds}s`;
}

export function LibraryPage() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <main className="demon-page">
        <section className="demon-page-inner grid gap-5 pb-24 sm:pb-0">
          <DemonPageHeader
            eyebrow="Audio Grimoire"
            title="Books"
            description="管理本地有声书、查看生成进度，并从任何已完成章节继续听。"
            icon={Headphones}
            actions={
              <Link className="demon-button-primary" href="/upload">
                Upload text
              </Link>
            }
          />
          <LibraryPageContent />
        </section>
      </main>
    </QueryClientProvider>
  );
}
