import type {
  BookRepository,
  ChunkRepository,
  JobRepository,
  PartRepository,
} from "@/server/ports/repositories";
import type { FileStorage } from "@/server/ports/storage";
import type { Job } from "@/server/domain/entities";

export type DeleteBookDeps = {
  books: BookRepository;
  chunks: ChunkRepository;
  jobs: JobRepository;
  parts: PartRepository;
  storage: FileStorage;
};

export type DeleteBookResult = {
  deleted: boolean;
};

export async function deleteBook(
  deps: DeleteBookDeps,
  bookId: string,
): Promise<DeleteBookResult> {
  const book = await deps.books.findById(bookId);
  if (!book) {
    return { deleted: false };
  }

  const parts = await deps.parts.listByBookId(bookId);
  const jobs = await deps.jobs.listByBookId(bookId);
  await Promise.all(
    jobs
      .filter((job) => !isTerminalJob(job))
      .map((job) =>
        deps.jobs.updateById(job.id, {
          status: "cancelled",
          errorMessage: "Book was deleted.",
        }),
      ),
  );

  const chunks = (
    await Promise.all(parts.map((part) => deps.chunks.listByPartId(part.id)))
  ).flat();
  const partIds = parts.map((part) => part.id);
  const cacheFiles = await listBookCacheFiles(
    deps.storage,
    bookId,
    jobs.map((job) => job.id),
  );
  const filePaths = [
    book.sourcePath,
    ...cacheFiles,
    ...parts
      .map((part) => part.audioPath)
      .filter((audioPath): audioPath is string => Boolean(audioPath)),
    ...chunks
      .map((chunk) => chunk.audioPath)
      .filter((audioPath): audioPath is string => Boolean(audioPath)),
  ];

  await deps.chunks.deleteByPartIds(partIds);
  await deps.jobs.deleteByBookId(bookId);
  await deps.parts.deleteByBookId(bookId);
  await deps.books.deleteById(bookId);

  await Promise.all(filePaths.map((filePath) => deps.storage.deleteFile(filePath)));

  return { deleted: true };
}

function isTerminalJob(job: Job): boolean {
  return ["completed", "completed_with_errors", "failed", "cancelled"].includes(
    job.status,
  );
}

async function listBookCacheFiles(
  storage: FileStorage,
  bookId: string,
  jobIds: string[],
): Promise<string[]> {
  const [cleanedFiles, reportFiles] = await Promise.all([
    storage.listFiles("cleaned"),
    storage.listFiles("reports"),
  ]);
  const cacheIds = [bookId, ...jobIds];

  return [...cleanedFiles, ...reportFiles].filter((filePath) =>
    cacheIds.some((id) => filePath.includes(id)),
  );
}
