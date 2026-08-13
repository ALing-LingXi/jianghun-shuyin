import type { ReadingBook } from "@/server/domain/readingEntities";
import type {
  ReadingBookRepository,
  ReadingChapterRepository,
} from "@/server/ports/readingRepositories";
import type {
  ReadingBookDetailDto,
  ReadingBookSummaryDto,
  ReadingChapterDetailDto,
  ReadingLibraryDto,
} from "@/shared/schemas/reading";

export type QueryReadingLibraryDeps = {
  readingBooks: ReadingBookRepository;
  readingChapters: ReadingChapterRepository;
};

export async function queryReadingLibrary(
  deps: QueryReadingLibraryDeps,
): Promise<ReadingLibraryDto> {
  const books = await deps.readingBooks.listRecent();
  const summaries = await Promise.all(
    books.map((book) => toSummary(deps, book)),
  );

  return { books: summaries };
}

export async function queryReadingBook(
  deps: QueryReadingLibraryDeps,
  bookId: string,
): Promise<ReadingBookDetailDto | null> {
  const book = await deps.readingBooks.findById(bookId);
  if (!book) {
    return null;
  }

  const [summary, chapters] = await Promise.all([
    toSummary(deps, book),
    deps.readingChapters.listByBookId(bookId),
  ]);

  return {
    ...summary,
    chapters: chapters.map((chapter) => ({
      id: chapter.id,
      index: chapter.index,
      title: chapter.title,
    })),
  };
}

export async function queryReadingChapter(
  deps: QueryReadingLibraryDeps,
  bookId: string,
  chapterIndex: number,
): Promise<ReadingChapterDetailDto | null> {
  const [book, chapter, chapterCount] = await Promise.all([
    deps.readingBooks.findById(bookId),
    deps.readingChapters.findByBookIdAndIndex(bookId, chapterIndex),
    deps.readingChapters.countByBookId(bookId),
  ]);

  if (!book || !chapter) {
    return null;
  }

  const summary = await toSummary(deps, book, chapterCount);

  return {
    book: summary,
    chapter: {
      id: chapter.id,
      index: chapter.index,
      title: chapter.title,
      content: chapter.content,
    },
    previousChapterIndex: chapter.index > 0 ? chapter.index - 1 : null,
    nextChapterIndex:
      chapter.index + 1 < chapterCount ? chapter.index + 1 : null,
  };
}

export async function updateReadingProgress(
  deps: QueryReadingLibraryDeps,
  bookId: string,
  chapterIndex: number,
): Promise<ReadingBookSummaryDto | null> {
  const chapter = await deps.readingChapters.findByBookIdAndIndex(
    bookId,
    chapterIndex,
  );
  if (!chapter) {
    return null;
  }

  const book = await deps.readingBooks.updateById(bookId, {
    currentChapterIndex: chapterIndex,
  });
  return book ? toSummary(deps, book) : null;
}

async function toSummary(
  deps: QueryReadingLibraryDeps,
  book: ReadingBook,
  knownChapterCount?: number,
): Promise<ReadingBookSummaryDto> {
  const chapterCount =
    knownChapterCount ?? (await deps.readingChapters.countByBookId(book.id));

  return {
    id: book.id,
    title: book.title,
    author: book.author,
    coverUrl: `/api/reading/books/${book.id}/cover`,
    status: book.status,
    chapterCount,
    currentChapterIndex: Math.min(
      book.currentChapterIndex,
      Math.max(0, chapterCount - 1),
    ),
    createdAt: book.createdAt.toISOString(),
  };
}
