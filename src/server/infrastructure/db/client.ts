import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export function createDatabaseClient(filename: string) {
  const sqlite = new Database(filename);
  sqlite.pragma("foreign_keys = ON");

  return {
    sqlite,
    db: drizzle(sqlite, { schema }),
  };
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;
export type AppDatabase = DatabaseClient["db"];
