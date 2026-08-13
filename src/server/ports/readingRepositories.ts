import type {
  ReadingBook,
  ReadingChapter,
} from "@/server/domain/readingEntities";
import type { ReadingBookStatus } from "@/shared/types/entities";

export type CreateReadingBookInput = {
  title: string;
  author?: string | null;
  sourcePath: string;
  coverPath: string;
  status?: ReadingBookStatus;
  currentChapterIndex?: number;
};

export type UpdateReadingBookInput = {
  currentChapterIndex?: number;
  status?: ReadingBookStatus;
};

export interface ReadingBookRepository {
  create(input: CreateReadingBookInput): Promise<ReadingBook>;
  findById(id: string): Promise<ReadingBook | null>;
  listRecent(limit?: number): Promise<ReadingBook[]>;
  updateById(
    id: string,
    input: UpdateReadingBookInput,
  ): Promise<ReadingBook | null>;
  deleteById(id: string): Promise<void>;
}

export type CreateReadingChapterInput = {
  bookId: string;
  index: number;
  title: string;
  content: string;
};

export interface ReadingChapterRepository {
  createMany(input: CreateReadingChapterInput[]): Promise<ReadingChapter[]>;
  listByBookId(bookId: string): Promise<ReadingChapter[]>;
  findByBookIdAndIndex(
    bookId: string,
    index: number,
  ): Promise<ReadingChapter | null>;
  countByBookId(bookId: string): Promise<number>;
  deleteByBookId(bookId: string): Promise<void>;
}
