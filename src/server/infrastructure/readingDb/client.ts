import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export function createReadingDatabaseClient(filename: string) {
  const sqlite = new Database(filename);
  sqlite.pragma("foreign_keys = ON");

  return {
    sqlite,
    db: drizzle(sqlite, { schema }),
  };
}

export type ReadingDatabaseClient = ReturnType<
  typeof createReadingDatabaseClient
>;
export type ReadingDatabase = ReadingDatabaseClient["db"];
