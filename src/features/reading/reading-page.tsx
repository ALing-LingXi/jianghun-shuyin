"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
  Menu,
} from "lucide-react";
import { ReadingShell } from "./components/reading-shell";
import {
  useReadingBookQuery,
  useReadingChapterQuery,
  useUpdateReadingProgress,
} from "./hooks/useReadingLibraryQuery";

export function ReadingPage() {
  return (
    <ReadingShell>
      <ReadingPageContent />
    </ReadingShell>
  );
}

function ReadingPageContent() {
  const params = useParams<{ bookId: string; chapterIndex: string }>();
  const router = useRouter();
  const bookId = params.bookId;
  const chapterIndex = Number.parseInt(params.chapterIndex, 10);
  const safeChapterIndex = Number.isFinite(chapterIndex) ? chapterIndex : 0;
  const bookQuery = useReadingBookQuery(bookId);
  const chapterQuery = useReadingChapterQuery(bookId, safeChapterIndex);
  const { mutate: saveProgress } = useUpdateReadingProgress();

  useEffect(() => {
    if (bookId && Number.isFinite(chapterIndex)) {
      saveProgress({ bookId, chapterIndex: safeChapterIndex });
    }
  }, [bookId, chapterIndex, safeChapterIndex, saveProgress]);

  function goToChapter(index: number) {
    router.push(`/reading/${bookId}/chapters/${index}`);
  }

  return (
    <main className="demon-page">
      <div className="demon-page-inner grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
          <div className="demon-panel grid h-full grid-rows-[auto_auto_minmax(0,1fr)] gap-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <Link
                className="demon-back-link mb-0"
                href="/reading"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                书架
              </Link>
              <Menu className="size-4 text-fuchsia-100/50" aria-hidden="true" />
            </div>

            {bookQuery.isPending ? (
              <div className="flex items-center gap-2 text-sm text-fuchsia-100/70">
                <LoaderCircle className="size-4 animate-spin" />
                加载目录...
              </div>
            ) : bookQuery.isError ? (
              <p className="text-sm text-red-100">目录加载失败。</p>
            ) : (
              <>
                <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 lg:grid-cols-1">
                  <Image
                    className="aspect-[3/4] w-20 border border-fuchsia-200/20 object-cover shadow-[4px_4px_0_#59043b] lg:w-28"
                    src={bookQuery.data.coverUrl}
                    alt={`${bookQuery.data.title} 封面`}
                    width={112}
                    height={149}
                    unoptimized
                  />
                  <div className="min-w-0">
                    <h1 className="truncate text-xl font-bold text-white">
                      {bookQuery.data.title}
                    </h1>
                    <p className="mt-1 truncate text-sm text-fuchsia-100/50">
                      {bookQuery.data.author ?? "未知作者"}
                    </p>
                    <p className="mt-2 text-xs font-bold text-amber-100/80">
                      共 {bookQuery.data.chapterCount} 章
                    </p>
                  </div>
                </div>

                <nav
                  className="pretty-scrollbar min-h-0 overflow-y-auto pr-1"
                  aria-label="章节目录"
                >
                  <ul className="grid gap-1 pb-2">
                    {bookQuery.data.chapters.map((chapter) => {
                      const isCurrent = chapter.index === safeChapterIndex;

                      return (
                        <li key={chapter.id}>
                          <button
                            type="button"
                            className={`w-full px-3 py-2 text-left text-sm transition ${
                              isCurrent
                                ? "bg-fuchsia-500 text-white shadow-[3px_3px_0_#680445]"
                                : "text-fuchsia-100/65 hover:bg-white/10 hover:text-white"
                            }`}
                            onClick={() => goToChapter(chapter.index)}
                          >
                            <span className="block truncate">{chapter.title}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              </>
            )}
          </div>
        </aside>

        <article className="demon-panel min-w-0">
          {chapterQuery.isPending ? (
            <div className="grid min-h-[60vh] place-items-center p-8 text-fuchsia-100/70">
              <div className="flex items-center gap-3">
                <LoaderCircle className="size-5 animate-spin text-amber-200" />
                正在展开章节...
              </div>
            </div>
          ) : chapterQuery.isError ? (
            <div className="grid min-h-[60vh] place-items-center p-8">
              <div className="grid max-w-md gap-3 text-center">
                <CircleAlert className="mx-auto size-8 text-red-200" />
                <h2 className="text-xl font-bold text-white">章节加载失败</h2>
                <p className="text-sm text-red-100/75">
                  请返回书架重新进入，或检查这本书是否还存在。
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto grid max-w-3xl gap-8 px-5 py-8 sm:px-8 lg:px-12">
              <header className="grid gap-4 border-b border-fuchsia-100/10 pb-6">
                <p className="inline-flex w-fit items-center gap-2 border border-amber-100/20 bg-amber-200/10 px-3 py-1 text-xs font-bold text-amber-100">
                  <BookOpen className="size-3.5" aria-hidden="true" />
                  第 {chapterQuery.data.chapter.index + 1} 章
                </p>
                <h2 className="text-3xl font-bold leading-tight text-white sm:text-4xl">
                  {chapterQuery.data.chapter.title}
                </h2>
              </header>

              <div className="reading-content whitespace-pre-wrap text-lg leading-9 text-rose-50/88 sm:text-xl sm:leading-10">
                {chapterQuery.data.chapter.content}
              </div>

              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-fuchsia-100/10 pt-6">
                <button
                  type="button"
                  className="demon-button-secondary"
                  disabled={chapterQuery.data.previousChapterIndex === null}
                  onClick={() => {
                    if (chapterQuery.data.previousChapterIndex !== null) {
                      goToChapter(chapterQuery.data.previousChapterIndex);
                    }
                  }}
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                  上一章
                </button>
                <button
                  type="button"
                  className="demon-button-primary"
                  disabled={chapterQuery.data.nextChapterIndex === null}
                  onClick={() => {
                    if (chapterQuery.data.nextChapterIndex !== null) {
                      goToChapter(chapterQuery.data.nextChapterIndex);
                    }
                  }}
                >
                  下一章
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              </footer>
            </div>
          )}
        </article>
      </div>
    </main>
  );
}
