import type {
  BookStatus,
  ChunkStatus,
  JobStage,
  JobStatus,
  PartStatus,
} from "@/shared/types/entities";

export type Book = {
  id: string;
  title: string;
  author: string | null;
  sourcePath: string;
  status: BookStatus;
  createdAt: Date;
};

export type Job = {
  id: string;
  bookId: string;
  status: JobStatus;
  stage: JobStage;
  progress: number;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Part = {
  id: string;
  bookId: string;
  index: number;
  title: string;
  audioPath: string | null;
  durationSeconds: number | null;
  status: PartStatus;
};

export type Chunk = {
  id: string;
  partId: string;
  index: number;
  textHash: string;
  audioPath: string | null;
  status: ChunkStatus;
  retryCount: number;
  errorMessage: string | null;
};
