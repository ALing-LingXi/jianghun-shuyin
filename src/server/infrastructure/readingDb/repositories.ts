import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq } from "drizzle-orm";
import type {
  ReadingBook,
  ReadingChapter,
} from "@/server/domain/readingEntities";
import type {
  CreateReadingBookInput,
  CreateReadingChapterInput,
  ReadingBookRepository,
  ReadingChapterRepository,
  UpdateReadingBookInput,
} from "@/server/ports/readingRepositories";
import type { ReadingBookStatus } from "@/shared/types/entities";
import type { ReadingDatabase } from "./client";
import { readingBooks, readingChapters } from "./schema";

type ReadingBookRow = typeof readingBooks.$inferSelect;
type ReadingChapterRow = typeof readingChapters.$inferSelect;

export class DrizzleReadingBookRepository implements ReadingBookRepository {
  constructor(private readonly db: ReadingDatabase) {}

  async create(input: CreateReadingBookInput): Promise<ReadingBook> {
    const now = new Date();
    const book: ReadingBook = {
      id: randomUUID(),
      title: input.title,
      author: input.author ?? null,
      sourcePath: input.sourcePath,
      coverPath: input.coverPath,
      status: input.status ?? "ready",
      currentChapterIndex: input.currentChapterIndex ?? 0,
      createdAt: now,
      updatedAt: now,
    };

    this.db.insert(readingBooks).values(book).run();
    return book;
  }

  async findById(id: string): Promise<ReadingBook | null> {
    const row = this.db
      .select()
      .from(readingBooks)
      .where(eq(readingBooks.id, id))
      .get();
    return row ? toReadingBook(row) : null;
  }

  async listRecent(limit = 50): Promise<ReadingBook[]> {
    return this.db
      .select()
      .from(readingBooks)
      .orderBy(desc(readingBooks.updatedAt))
      .limit(limit)
      .all()
      .map(toReadingBook);
  }

  async updateById(
    id: string,
    input: UpdateReadingBookInput,
  ): Promise<ReadingBook | null> {
    const current = await this.findById(id);
    if (!current) {
      return null;
    }

    const updated: ReadingBook = {
      ...current,
      ...input,
      status: input.status ?? current.status,
      currentChapterIndex:
        input.currentChapterIndex ?? current.currentChapterIndex,
      updatedAt: new Date(),
    };

    this.db
      .update(readingBooks)
      .set(updated)
      .where(eq(readingBooks.id, id))
      .run();
    return updated;
  }

  async deleteById(id: string): Promise<void> {
    this.db.delete(readingBooks).where(eq(readingBooks.id, id)).run();
  }
}

export class DrizzleReadingChapterRepository
  implements ReadingChapterRepository
{
  constructor(private readonly db: ReadingDatabase) {}

  async createMany(
    input: CreateReadingChapterInput[],
  ): Promise<ReadingChapter[]> {
    if (input.length === 0) {
      return [];
    }

    const chapters: ReadingChapter[] = input.map((chapter) => ({
      id: randomUUID(),
      bookId: chapter.bookId,
      index: chapter.index,
      title: chapter.title,
      content: chapter.content,
    }));

    for (let start = 0; start < chapters.length; start += 100) {
      this.db
        .insert(readingChapters)
        .values(chapters.slice(start, start + 100))
        .run();
    }

    return chapters;
  }

  async listByBookId(bookId: string): Promise<ReadingChapter[]> {
    return this.db
      .select()
      .from(readingChapters)
      .where(eq(readingChapters.bookId, bookId))
      .orderBy(asc(readingChapters.index))
      .all()
      .map(toReadingChapter);
  }

  async findByBookIdAndIndex(
    bookId: string,
    index: number,
  ): Promise<ReadingChapter | null> {
    const row = this.db
      .select()
      .from(readingChapters)
      .where(
        and(
          eq(readingChapters.bookId, bookId),
          eq(readingChapters.index, index),
        ),
      )
      .get();

    return row ? toReadingChapter(row) : null;
  }

  async countByBookId(bookId: string): Promise<number> {
    const row = this.db
      .select({ value: count() })
      .from(readingChapters)
      .where(eq(readingChapters.bookId, bookId))
      .get();

    return row?.value ?? 0;
  }

  async deleteByBookId(bookId: string): Promise<void> {
    this.db
      .delete(readingChapters)
      .where(eq(readingChapters.bookId, bookId))
      .run();
  }
}

function toReadingBook(row: ReadingBookRow): ReadingBook {
  return {
    ...row,
    status: row.status as ReadingBookStatus,
  };
}

function toReadingChapter(row: ReadingChapterRow): ReadingChapter {
  return row;
}
