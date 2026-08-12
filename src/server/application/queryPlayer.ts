import type { PlayerDto } from "@/shared/schemas/player";
import type {
  BookRepository,
  ChunkRepository,
  PartRepository,
} from "@/server/ports/repositories";

export type QueryPlayerDeps = {
  books: BookRepository;
  parts: PartRepository;
  chunks?: ChunkRepository;
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
    parts: await Promise.all(
      parts.map(async (part) => ({
        id: part.id,
        index: part.index,
        title: part.title,
        status: part.status,
        audioUrl:
          part.status === "completed" && part.audioPath
            ? buildPlayerAudioUrl(bookId, part.id)
            : null,
        durationSeconds: part.durationSeconds,
        errorMessage:
          part.status === "failed" ? await findPartError(deps, part.id) : null,
      })),
    ),
  };
}

function buildPlayerAudioUrl(bookId: string, partId: string) {
  return `/api/player/books/${bookId}?partId=${partId}`;
}

async function findPartError(
  deps: QueryPlayerDeps,
  partId: string,
): Promise<string | null> {
  if (!deps.chunks) {
    return null;
  }

  const chunks = await deps.chunks.listByPartId(partId);
  return (
    chunks.find((chunk) => chunk.status === "failed" && chunk.errorMessage)
      ?.errorMessage ?? null
  );
}
