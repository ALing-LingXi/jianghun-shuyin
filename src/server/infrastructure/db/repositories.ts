import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Book, Chunk, Job, Part } from "@/server/domain/entities";
import type {
  BookRepository,
  ChunkRepository,
  CreateBookInput,
  CreateChunkInput,
  CreateJobInput,
  CreatePartInput,
  JobRepository,
  PartRepository,
} from "@/server/ports/repositories";
import type {
  BookStatus,
  ChunkStatus,
  JobStage,
  JobStatus,
  PartStatus,
} from "@/shared/types/entities";
import type { AppDatabase } from "./client";
import { books, chunks, jobs, parts } from "./schema";

type BookRow = typeof books.$inferSelect;
type JobRow = typeof jobs.$inferSelect;
type PartRow = typeof parts.$inferSelect;
type ChunkRow = typeof chunks.$inferSelect;

export class DrizzleBookRepository implements BookRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreateBookInput): Promise<Book> {
    const book: Book = {
      id: randomUUID(),
      title: input.title,
      author: input.author ?? null,
      sourcePath: input.sourcePath,
      status: input.status ?? "pending",
      createdAt: new Date(),
    };

    this.db.insert(books).values(book).run();
    return book;
  }

  async findById(id: string): Promise<Book | null> {
    const row = this.db.select().from(books).where(eq(books.id, id)).get();
    return row ? toBook(row) : null;
  }
}

export class DrizzleJobRepository implements JobRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreateJobInput): Promise<Job> {
    const now = new Date();
    const job: Job = {
      id: randomUUID(),
      bookId: input.bookId,
      status: input.status ?? "queued",
      stage: input.stage ?? "decoding",
      progress: input.progress ?? 0,
      errorMessage: input.errorMessage ?? null,
      createdAt: now,
      updatedAt: now,
    };

    this.db.insert(jobs).values(job).run();
    return job;
  }

  async findById(id: string): Promise<Job | null> {
    const row = this.db.select().from(jobs).where(eq(jobs.id, id)).get();
    return row ? toJob(row) : null;
  }
}

function toBook(row: BookRow): Book {
  return {
    ...row,
    status: row.status as BookStatus,
  };
}

function toJob(row: JobRow): Job {
  return {
    ...row,
    status: row.status as JobStatus,
    stage: row.stage as JobStage,
  };
}

export class DrizzlePartRepository implements PartRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreatePartInput): Promise<Part> {
    const part: Part = {
      id: randomUUID(),
      bookId: input.bookId,
      index: input.index,
      title: input.title,
      audioPath: input.audioPath ?? null,
      durationSeconds: input.durationSeconds ?? null,
      status: input.status ?? "pending",
    };

    this.db.insert(parts).values(part).run();
    return part;
  }

  async findById(id: string): Promise<Part | null> {
    const row = this.db.select().from(parts).where(eq(parts.id, id)).get();
    return row ? toPart(row) : null;
  }
}

export class DrizzleChunkRepository implements ChunkRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreateChunkInput): Promise<Chunk> {
    const chunk: Chunk = {
      id: randomUUID(),
      partId: input.partId,
      index: input.index,
      textHash: input.textHash,
      audioPath: input.audioPath ?? null,
      status: input.status ?? "pending",
      retryCount: input.retryCount ?? 0,
      errorMessage: input.errorMessage ?? null,
    };

    this.db.insert(chunks).values(chunk).run();
    return chunk;
  }

  async findById(id: string): Promise<Chunk | null> {
    const row = this.db.select().from(chunks).where(eq(chunks.id, id)).get();
    return row ? toChunk(row) : null;
  }
}

function toPart(row: PartRow): Part {
  return {
    ...row,
    status: row.status as PartStatus,
  };
}

function toChunk(row: ChunkRow): Chunk {
  return {
    ...row,
    status: row.status as ChunkStatus,
  };
}
