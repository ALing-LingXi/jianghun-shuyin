import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  createDatabaseClient,
  DrizzleBookRepository,
  DrizzleJobRepository,
  initializeDatabase,
} from "@/server/infrastructure/db";
import { LocalStorage } from "@/server/infrastructure/localStorage";
import { createBookJob } from "@/server/application/createBookJob";

const defaultDatabasePath = path.join(process.cwd(), "storage", "jianghun-shuyin.db");
const defaultStorageRoot = path.join(process.cwd(), "storage");

export function createContainer() {
  mkdirSync(defaultStorageRoot, { recursive: true });

  const client = createDatabaseClient(defaultDatabasePath);
  initializeDatabase(client.db);

  const books = new DrizzleBookRepository(client.db);
  const jobs = new DrizzleJobRepository(client.db);
  const storage = new LocalStorage(defaultStorageRoot);

  return {
    createBookJob: (input: Parameters<typeof createBookJob>[1]) =>
      createBookJob({ books, jobs, storage }, input),
  };
}
