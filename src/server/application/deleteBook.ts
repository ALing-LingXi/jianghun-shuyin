import type {
  BookRepository,
  ChunkRepository,
  JobRepository,
  PartRepository,
} from "@/server/ports/repositories";
import type { FileStorage } from "@/server/ports/storage";

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
  const chunks = (
    await Promise.all(parts.map((part) => deps.chunks.listByPartId(part.id)))
  ).flat();
  const partIds = parts.map((part) => part.id);
  const filePaths = [
    book.sourcePath,
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
