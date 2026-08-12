import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  createDatabaseClient,
  DrizzleBookRepository,
  DrizzleChunkRepository,
  DrizzleJobRepository,
  DrizzlePartRepository,
  initializeDatabase,
} from "@/server/infrastructure/db";
import { createBookJob } from "@/server/application/createBookJob";
import { deleteBook } from "@/server/application/deleteBook";
import { queryJob } from "@/server/application/queryJob";
import { queryLibrary } from "@/server/application/queryLibrary";
import { queryPlayer } from "@/server/application/queryPlayer";
import { retryChunk } from "@/server/application/retryChunk";
import { EdgeTtsProvider } from "@/server/infrastructure/edgeTtsProvider";
import { EdgeTtsVoiceCatalog } from "@/server/infrastructure/edgeTtsVoiceCatalog";
import { FfmpegAudio } from "@/server/infrastructure/ffmpegAudio";
import { LocalStorage } from "@/server/infrastructure/localStorage";

const defaultDatabasePath = path.join(
  process.cwd(),
  "storage",
  "jianghun-shuyin.db",
);
const defaultStorageRoot = path.join(process.cwd(), "storage");

export function createContainer() {
  mkdirSync(defaultStorageRoot, { recursive: true });

  const client = createDatabaseClient(defaultDatabasePath);
  initializeDatabase(client.db);

  const books = new DrizzleBookRepository(client.db);
  const jobs = new DrizzleJobRepository(client.db);
  const parts = new DrizzlePartRepository(client.db);
  const chunks = new DrizzleChunkRepository(client.db);
  const storage = new LocalStorage(defaultStorageRoot);
  const ttsProvider = new EdgeTtsProvider({ storage });
  const voiceCatalog = new EdgeTtsVoiceCatalog();
  const audioAssembler = new FfmpegAudio({
    outputDir: path.join(defaultStorageRoot, "parts"),
  });

  return {
    createBookJob: (input: Parameters<typeof createBookJob>[1]) =>
      createBookJob({ books, jobs, storage }, input),
    deleteBook: (bookId: string) =>
      deleteBook({ books, chunks, jobs, parts, storage }, bookId),
    queryJob: (jobId: string) => queryJob({ jobs }, jobId),
    queryLibrary: () => queryLibrary({ books, jobs, parts }),
    queryPlayer: (bookId: string) => queryPlayer({ books, parts }, bookId),
    retryChunk: (input: Parameters<typeof retryChunk>[1]) =>
      retryChunk({ chunks, tts: ttsProvider }, input),
    audioAssembler,
    parts,
    ttsProvider,
    voiceCatalog,
  };
}
