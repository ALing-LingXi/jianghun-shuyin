import type { Book, Chunk, Job, Part } from "@/server/domain/entities";
import type {
  BookStatus,
  ChunkStatus,
  JobStage,
  JobStatus,
  PartStatus,
} from "@/shared/types/entities";

export type CreateBookInput = {
  title: string;
  author?: string | null;
  sourcePath: string;
  status?: BookStatus;
};

export interface BookRepository {
  create(input: CreateBookInput): Promise<Book>;
  findById(id: string): Promise<Book | null>;
}

export type CreateJobInput = {
  bookId: string;
  status?: JobStatus;
  stage?: JobStage;
  progress?: number;
  errorMessage?: string | null;
};

export type UpdateJobInput = {
  status?: JobStatus;
  stage?: JobStage;
  progress?: number;
  errorMessage?: string | null;
};

export interface JobRepository {
  create(input: CreateJobInput): Promise<Job>;
  findById(id: string): Promise<Job | null>;
  updateById(id: string, input: UpdateJobInput): Promise<Job | null>;
}

export type CreatePartInput = {
  bookId: string;
  index: number;
  title: string;
  audioPath?: string | null;
  durationSeconds?: number | null;
  status?: PartStatus;
};

export interface PartRepository {
  create(input: CreatePartInput): Promise<Part>;
  findById(id: string): Promise<Part | null>;
}

export type CreateChunkInput = {
  partId: string;
  index: number;
  textHash: string;
  audioPath?: string | null;
  status?: ChunkStatus;
  retryCount?: number;
  errorMessage?: string | null;
};

export interface ChunkRepository {
  create(input: CreateChunkInput): Promise<Chunk>;
  findById(id: string): Promise<Chunk | null>;
}
