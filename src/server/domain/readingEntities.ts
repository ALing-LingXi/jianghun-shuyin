import type { ReadingBookStatus } from "@/shared/types/entities";

export type ReadingBook = {
  id: string;
  title: string;
  author: string | null;
  sourcePath: string;
  coverPath: string;
  status: ReadingBookStatus;
  currentChapterIndex: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ReadingChapter = {
  id: string;
  bookId: string;
  index: number;
  title: string;
  content: string;
};
