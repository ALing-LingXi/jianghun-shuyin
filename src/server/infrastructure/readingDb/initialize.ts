import { sql } from "drizzle-orm";
import type { ReadingDatabase } from "./client";

export function initializeReadingDatabase(db: ReadingDatabase): void {
  db.run(sql`
    CREATE TABLE IF NOT EXISTS reading_books (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      author TEXT,
      source_path TEXT NOT NULL,
      cover_path TEXT NOT NULL,
      status TEXT NOT NULL,
      current_chapter_index INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS reading_chapters (
      id TEXT PRIMARY KEY NOT NULL,
      book_id TEXT NOT NULL REFERENCES reading_books(id),
      chapter_index INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL
    )
  `);
}
