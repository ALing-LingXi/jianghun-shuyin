import type { BookRepository, JobRepository } from "@/server/ports/repositories";
import type { FileStorage } from "@/server/ports/storage";
import type { UploadTextDto, UploadTextResponseDto } from "@/shared/schemas/upload";

export type CreateBookJobDeps = {
  books: BookRepository;
  jobs: JobRepository;
  storage: FileStorage;
};

export async function createBookJob(
  deps: CreateBookJobDeps,
  input: UploadTextDto,
): Promise<UploadTextResponseDto> {
  const sourcePath = await deps.storage.saveTextSource({
    content: input.text,
    fileName: `${input.title}.txt`,
  });

  const book = await deps.books.create({
    title: input.title,
    author: input.author ?? null,
    sourcePath,
  });

  const job = await deps.jobs.create({
    bookId: book.id,
    status: "queued",
    stage: "decoding",
    progress: 0,
    errorMessage: null,
  });

  return {
    bookId: book.id,
    jobId: job.id,
  };
}
