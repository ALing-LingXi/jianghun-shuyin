"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  BookMarked,
  BookOpen,
  CircleAlert,
  LoaderCircle,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { DemonPageHeader } from "@/features/ui/demon-page-header";
import type { ReadingBookSummaryDto } from "@/shared/schemas/reading";
import { ReadingShell } from "./components/reading-shell";
import {
  ReadingApiError,
  useDeleteReadingBook,
  useReadingLibraryQuery,
} from "./hooks/useReadingLibraryQuery";

export function ReadingLibraryPage() {
  return (
    <ReadingShell>
      <main className="demon-page">
        <div className="demon-page-inner grid gap-5">
          <DemonPageHeader
            eyebrow="Devil Reader"
            title="阅读书架"
            description="独立管理可阅读小说。TXT 入库后按章节展开，封面和阅读位置都保留在本地。"
            icon={BookMarked}
            actions={
              <>
                <Link className="demon-button-secondary" href="/books">
                  <BookMarked className="size-4" aria-hidden="true" />
                  听书书架
                </Link>
                <Link className="demon-button-primary" href="/reading/upload">
                  <Plus className="size-4" aria-hidden="true" />
                  上传阅读书籍
                </Link>
              </>
            }
          />
          <ReadingLibraryContent />
        </div>
      </main>
    </ReadingShell>
  );
}

function ReadingLibraryContent() {
  const query = useReadingLibraryQuery();

  if (query.isPending) {
    return (
      <section className="demon-panel grid gap-4 p-6">
        <div className="flex items-center gap-3 text-fuchsia-100">
          <LoaderCircle className="size-5 animate-spin text-amber-200" />
          正在召唤书架...
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-80 border border-fuchsia-100/10 bg-white/[0.04]"
            />
          ))}
        </div>
      </section>
    );
  }

  if (query.isError) {
    const error = query.error as ReadingApiError;
    return (
      <section className="demon-panel grid gap-4 border-red-300/30 p-6">
        <div className="flex items-center gap-3 text-red-100">
          <CircleAlert className="size-5" aria-hidden="true" />
          阅读书架加载失败
        </div>
        <p className="text-sm text-red-100/80">{error.message}</p>
        <button
          type="button"
          className="demon-button-secondary w-fit"
          onClick={() => void query.refetch()}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          重试
        </button>
      </section>
    );
  }

  if (query.data.books.length === 0) {
    return (
      <section className="demon-panel grid min-h-80 place-items-center p-8 text-center">
        <div className="grid max-w-md justify-items-center gap-4">
          <div className="grid size-20 place-items-center border border-amber-200/20 bg-amber-200/10 text-amber-100">
            <BookOpen className="size-9" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-bold text-white">阅读书架还是空的</h2>
          <p className="text-sm leading-6 text-fuchsia-100/60">
            上传一本 TXT 小说和封面，就能进入章节阅读模式。
          </p>
          <Link className="demon-button-primary" href="/reading/upload">
            <Plus className="size-4" aria-hidden="true" />
            上传第一本书
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section>
      <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {query.data.books.map((book) => (
          <ReadingBookCard key={book.id} book={book} />
        ))}
      </ul>
    </section>
  );
}

function ReadingBookCard({ book }: { book: ReadingBookSummaryDto }) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const deleteBook = useDeleteReadingBook();
  const currentChapterHref = `/reading/${book.id}/chapters/${book.currentChapterIndex}`;

  async function handleDelete() {
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      deleteBook.reset();
      return;
    }

    await deleteBook.mutateAsync(book.id).catch(() => undefined);
  }

  return (
    <li className="demon-panel group grid overflow-hidden transition hover:-translate-y-0.5 hover:border-amber-200/50">
      <Link className="block" href={currentChapterHref}>
        <div className="relative aspect-[3/4] overflow-hidden bg-black">
          <Image
            className="object-cover transition duration-500 group-hover:scale-105"
            src={book.coverUrl}
            alt={`${book.title} 封面`}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
            unoptimized
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
          <span className="absolute right-3 bottom-3 border border-amber-100/30 bg-black/70 px-2.5 py-1 text-xs font-bold text-amber-100 backdrop-blur">
            {book.chapterCount} 章
          </span>
        </div>
      </Link>

      <div className="grid gap-4 p-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold text-white">{book.title}</h2>
          <p className="mt-1 truncate text-sm text-fuchsia-100/50">
            {book.author ?? "未知作者"}
          </p>
          <p className="mt-2 text-xs font-bold text-amber-100/80">
            读到第 {book.currentChapterIndex + 1} 章
          </p>
        </div>

        {deleteBook.isError ? (
          <p className="text-sm text-red-100" role="alert">
            删除失败：{deleteBook.error.message}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Link
            className="demon-button-primary flex-1"
            href={currentChapterHref}
          >
            <BookOpen className="size-4" aria-hidden="true" />
            继续阅读
          </Link>
          <button
            type="button"
            className={
              isConfirmingDelete
                ? "demon-button-danger"
                : "demon-button-secondary"
            }
            disabled={deleteBook.isPending}
            onClick={() => void handleDelete()}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {deleteBook.isPending
              ? "删除中"
              : isConfirmingDelete
                ? "确认"
                : "删除"}
          </button>
          {isConfirmingDelete ? (
            <button
              type="button"
              className="demon-button-secondary"
              disabled={deleteBook.isPending}
              onClick={() => {
                setIsConfirmingDelete(false);
                deleteBook.reset();
              }}
            >
              <X className="size-4" aria-hidden="true" />
              取消
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
