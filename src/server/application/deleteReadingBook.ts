import type {
  ReadingBookRepository,
  ReadingChapterRepository,
} from "@/server/ports/readingRepositories";
import type { FileStorage } from "@/server/ports/storage";

export type DeleteReadingBookDeps = {
  readingBooks: ReadingBookRepository;
  readingChapters: ReadingChapterRepository;
  storage: FileStorage;
};

export async function deleteReadingBook(
  deps: DeleteReadingBookDeps,
  bookId: string,
): Promise<{ deleted: boolean }> {
  const book = await deps.readingBooks.findById(bookId);
  if (!book) {
    return { deleted: false };
  }

  await deps.readingChapters.deleteByBookId(bookId);
  await deps.readingBooks.deleteById(bookId);
  await Promise.all([
    deps.storage.deleteFile(book.sourcePath),
    deps.storage.deleteFile(book.coverPath),
  ]);

  return { deleted: true };
}
