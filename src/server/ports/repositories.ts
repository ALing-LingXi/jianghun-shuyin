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
  listRecent(limit?: number): Promise<Book[]>;
  deleteById(id: string): Promise<void>;
}

export type CreateJobInput = {
  bookId: string;
  voice: string;
  rate: string;
  pitch: string;
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
  findLatestByBookId(bookId: string): Promise<Job | null>;
  updateById(id: string, input: UpdateJobInput): Promise<Job | null>;
  deleteByBookId(bookId: string): Promise<void>;
}

export type CreatePartInput = {
  bookId: string;
  index: number;
  title: string;
  audioPath?: string | null;
  durationSeconds?: number | null;
  status?: PartStatus;
};

export type UpdatePartInput = {
  audioPath?: string | null;
  durationSeconds?: number | null;
  status?: PartStatus;
};

export interface PartRepository {
  create(input: CreatePartInput): Promise<Part>;
  findById(id: string): Promise<Part | null>;
  listByBookId(bookId: string): Promise<Part[]>;
  updateById(id: string, input: UpdatePartInput): Promise<Part | null>;
  deleteByBookId(bookId: string): Promise<void>;
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

export type UpdateChunkInput = {
  audioPath?: string | null;
  status?: ChunkStatus;
  retryCount?: number;
  errorMessage?: string | null;
};

export interface ChunkRepository {
  create(input: CreateChunkInput): Promise<Chunk>;
  findById(id: string): Promise<Chunk | null>;
  listByPartId(partId: string): Promise<Chunk[]>;
  findCompletedByTextHash(textHash: string): Promise<Chunk | null>;
  updateById(id: string, input: UpdateChunkInput): Promise<Chunk | null>;
  deleteByPartIds(partIds: string[]): Promise<void>;
}
