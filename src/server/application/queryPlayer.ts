import type { PlayerDto } from "@/shared/schemas/player";
import type { BookRepository, PartRepository } from "@/server/ports/repositories";

export type QueryPlayerDeps = {
  books: BookRepository;
  parts: PartRepository;
};

export async function queryPlayer(
  deps: QueryPlayerDeps,
  bookId: string,
): Promise<PlayerDto | null> {
  const book = await deps.books.findById(bookId);
  if (!book) {
    return null;
  }

  const parts = await deps.parts.listByBookId(bookId);

  return {
    bookId,
    parts: parts
      .filter((part) => part.status === "completed" && part.audioPath)
      .map((part) => ({
        id: part.id,
        index: part.index,
        title: part.title,
        audioUrl: buildPlayerAudioUrl(bookId, part.id),
        durationSeconds: part.durationSeconds ?? 0,
      })),
  };
}

function buildPlayerAudioUrl(bookId: string, partId: string) {
  return `/api/player/books/${bookId}?partId=${partId}`;
}
