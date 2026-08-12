import type { BookRepository, JobRepository } from "@/server/ports/repositories";
import type { FileStorage } from "@/server/ports/storage";
import type {
  UploadFileDto,
  UploadTextDto,
  UploadTextResponseDto,
} from "@/shared/schemas/upload";
import {
  DEFAULT_TTS_PITCH,
  DEFAULT_TTS_RATE,
  DEFAULT_TTS_VOICE,
} from "@/shared/tts";

export type CreateBookJobDeps = {
  books: BookRepository;
  jobs: JobRepository;
  storage: FileStorage;
};

export type CreateBookJobInput =
  | UploadTextDto
  | (Omit<UploadFileDto, "fileSize"> & {
      source: Uint8Array;
    });

export async function createBookJob(
  deps: CreateBookJobDeps,
  input: CreateBookJobInput,
): Promise<UploadTextResponseDto> {
  const sourcePath = await saveSource(deps.storage, input);

  const book = await deps.books.create({
    title: input.title,
    author: input.author ?? null,
    sourcePath,
  });

  const job = await deps.jobs.create({
    bookId: book.id,
    voice: input.voice || DEFAULT_TTS_VOICE,
    rate: input.rate || DEFAULT_TTS_RATE,
    pitch: input.pitch || DEFAULT_TTS_PITCH,
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

function saveSource(
  storage: FileStorage,
  input: CreateBookJobInput,
): Promise<string> {
  if ("source" in input) {
    return storage.saveBinarySource({
      content: input.source,
      fileName: input.fileName,
    });
  }

  return storage.saveTextSource({
    content: input.text,
    fileName: `${input.title}.txt`,
  });
}
