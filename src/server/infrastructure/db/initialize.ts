import { sql } from "drizzle-orm";
import type { AppDatabase } from "./client";

export function initializeDatabase(db: AppDatabase): void {
  db.run(sql`
    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      author TEXT,
      source_path TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY NOT NULL,
      book_id TEXT NOT NULL REFERENCES books(id),
      status TEXT NOT NULL,
      stage TEXT NOT NULL,
      progress INTEGER NOT NULL,
      error_message TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS parts (
      id TEXT PRIMARY KEY NOT NULL,
      book_id TEXT NOT NULL REFERENCES books(id),
      part_index INTEGER NOT NULL,
      title TEXT NOT NULL,
      audio_path TEXT,
      duration_seconds INTEGER,
      status TEXT NOT NULL
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY NOT NULL,
      part_id TEXT NOT NULL REFERENCES parts(id),
      chunk_index INTEGER NOT NULL,
      text_hash TEXT NOT NULL,
      audio_path TEXT,
      status TEXT NOT NULL,
      retry_count INTEGER NOT NULL,
      error_message TEXT
    )
  `);
}
