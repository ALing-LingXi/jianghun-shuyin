import { mkdirSync } from "node:fs";
import path from "node:path";
import { createReadingBook } from "@/server/application/createReadingBook";
import { deleteReadingBook } from "@/server/application/deleteReadingBook";
import {
  queryReadingBook,
  queryReadingChapter,
  queryReadingLibrary,
  updateReadingProgress,
} from "@/server/application/queryReadingLibrary";
import {
  createReadingDatabaseClient,
  DrizzleReadingBookRepository,
  DrizzleReadingChapterRepository,
  initializeReadingDatabase,
} from "@/server/infrastructure/readingDb";
import { LocalStorage } from "@/server/infrastructure/localStorage";

const defaultReadingDatabasePath = path.join(
  process.cwd(),
  "storage",
  "jianghun-reading.db",
);
const defaultStorageRoot = path.join(process.cwd(), "storage");

export function createReadingContainer() {
  mkdirSync(defaultStorageRoot, { recursive: true });

  const client = createReadingDatabaseClient(defaultReadingDatabasePath);
  initializeReadingDatabase(client.db);

  const readingBooks = new DrizzleReadingBookRepository(client.db);
  const readingChapters = new DrizzleReadingChapterRepository(client.db);
  const storage = new LocalStorage(defaultStorageRoot);

  return {
    createReadingBook: (input: Parameters<typeof createReadingBook>[1]) =>
      createReadingBook({ readingBooks, readingChapters, storage }, input),
    deleteReadingBook: (bookId: string) =>
      deleteReadingBook({ readingBooks, readingChapters, storage }, bookId),
    queryReadingLibrary: () =>
      queryReadingLibrary({ readingBooks, readingChapters }),
    queryReadingBook: (bookId: string) =>
      queryReadingBook({ readingBooks, readingChapters }, bookId),
    queryReadingChapter: (bookId: string, chapterIndex: number) =>
      queryReadingChapter(
        { readingBooks, readingChapters },
        bookId,
        chapterIndex,
      ),
    updateReadingProgress: (bookId: string, chapterIndex: number) =>
      updateReadingProgress(
        { readingBooks, readingChapters },
        bookId,
        chapterIndex,
      ),
    readReadingCover: async (bookId: string) => {
      const book = await readingBooks.findById(bookId);
      if (!book) {
        return null;
      }

      const content = await storage.readBinaryFile(book.coverPath);
      return content ? { content, filePath: book.coverPath } : null;
    },
  };
}
