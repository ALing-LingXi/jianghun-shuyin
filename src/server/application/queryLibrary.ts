import type { Book, Job, Part } from "@/server/domain/entities";
import type {
  BookRepository,
  JobRepository,
  PartRepository,
} from "@/server/ports/repositories";
import type { BookStatus, JobStatus } from "@/shared/types/entities";

export type LibraryBookDto = {
  id: string;
  title: string;
  author: string | null;
  status: string;
  createdAt: string;
  latestJob: {
    id: string;
    status: string;
    stage: string;
    progress: number;
  } | null;
  partCount: number;
  playablePartCount: number;
  durationSeconds: number;
};

export type LibraryDto = {
  books: LibraryBookDto[];
};

export type QueryLibraryDeps = {
  books: BookRepository;
  jobs: JobRepository;
  parts: PartRepository;
};

export async function queryLibrary(
  deps: QueryLibraryDeps,
): Promise<LibraryDto> {
  const books = await deps.books.listRecent();

  const rows = await Promise.all(
    books.map(async (book) => {
      const [latestJob, parts] = await Promise.all([
        deps.jobs.findLatestByBookId(book.id),
        deps.parts.listByBookId(book.id),
      ]);

      return toLibraryBook(book, latestJob, parts);
    }),
  );

  return { books: rows };
}

function toLibraryBook(
  book: Book,
  latestJob: Job | null,
  parts: Part[],
): LibraryBookDto {
  const playableParts = parts.filter(
    (part) => part.status === "completed" && part.audioPath,
  );

  return {
    id: book.id,
    title: book.title,
    author: book.author,
    status: deriveBookStatus(book.status, latestJob?.status),
    createdAt: book.createdAt.toISOString(),
    latestJob: latestJob
      ? {
          id: latestJob.id,
          status: latestJob.status,
          stage: latestJob.stage,
          progress: latestJob.progress,
        }
      : null,
    partCount: parts.length,
    playablePartCount: playableParts.length,
    durationSeconds: playableParts.reduce(
      (total, part) => total + (part.durationSeconds ?? 0),
      0,
    ),
  };
}

function deriveBookStatus(
  bookStatus: BookStatus,
  latestJobStatus: JobStatus | undefined,
): BookStatus {
  switch (latestJobStatus) {
    case "queued":
      return "pending";
    case "processing":
      return "processing";
    case "completed":
    case "completed_with_errors":
      return "completed";
    case "failed":
    case "cancelled":
      return "failed";
    default:
      return bookStatus;
  }
}
