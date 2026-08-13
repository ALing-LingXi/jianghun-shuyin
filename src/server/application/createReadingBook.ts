import type {
  ReadingBookRepository,
  ReadingChapterRepository,
} from "@/server/ports/readingRepositories";
import type { FileStorage } from "@/server/ports/storage";
import {
  cleanText,
  decodeText,
  detectChapters,
  planParts,
} from "@/server/pipeline/text";
import type {
  ReadingUploadDto,
  ReadingUploadResponseDto,
} from "@/shared/schemas/reading";

export type CreateReadingBookDeps = {
  readingBooks: ReadingBookRepository;
  readingChapters: ReadingChapterRepository;
  storage: FileStorage;
};

export type CreateReadingBookInput = Omit<
  ReadingUploadDto,
  "fileSize" | "coverFileSize" | "coverMimeType"
> & {
  source: Uint8Array;
  cover: Uint8Array;
};

export async function createReadingBook(
  deps: CreateReadingBookDeps,
  input: CreateReadingBookInput,
): Promise<ReadingUploadResponseDto> {
  const [sourcePath, coverPath] = await Promise.all([
    deps.storage.saveBinarySource({
      content: input.source,
      fileName: input.fileName,
      subdirectory: "reading/sources",
    }),
    deps.storage.saveBinarySource({
      content: input.cover,
      fileName: input.coverFileName,
      subdirectory: "reading/covers",
    }),
  ]);

  const decode = decodeText(input.source);
  const clean = cleanText(decode.text);
  const detected = detectChapters(clean.text);
  const planned = planParts(clean.text, detected.chapters);

  if (planned.parts.length === 0) {
    throw new Error("NO_READABLE_CHAPTERS");
  }

  const book = await deps.readingBooks.create({
    title: input.title,
    author: input.author ?? null,
    sourcePath,
    coverPath,
    status: "ready",
    currentChapterIndex: 0,
  });

  await deps.readingChapters.createMany(
    planned.parts.map((part, index) => ({
      bookId: book.id,
      index,
      title: part.title,
      content: part.text,
    })),
  );

  return { bookId: book.id };
}
