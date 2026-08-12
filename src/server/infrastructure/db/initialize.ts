import { sql } from "drizzle-orm";
import type { AppDatabase } from "./client";
import {
  DEFAULT_TTS_PITCH,
  DEFAULT_TTS_RATE,
  DEFAULT_TTS_VOICE,
} from "@/server/tts/voiceCatalog";

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
      voice TEXT NOT NULL,
      rate TEXT NOT NULL,
      pitch TEXT NOT NULL,
      status TEXT NOT NULL,
      stage TEXT NOT NULL,
      progress INTEGER NOT NULL,
      error_message TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  ensureJobTtsColumns(db);

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

function ensureJobTtsColumns(db: AppDatabase): void {
  const jobColumns = db.all<{ name: string }>(sql`PRAGMA table_info(jobs)`);
  const columnNames = new Set(jobColumns.map((column) => column.name));

  if (!columnNames.has("voice")) {
    db.run(
      sql.raw(
        `ALTER TABLE jobs ADD COLUMN voice TEXT NOT NULL DEFAULT '${DEFAULT_TTS_VOICE}'`,
      ),
    );
  }

  if (!columnNames.has("rate")) {
    db.run(
      sql.raw(
        `ALTER TABLE jobs ADD COLUMN rate TEXT NOT NULL DEFAULT '${DEFAULT_TTS_RATE}'`,
      ),
    );
  }

  if (!columnNames.has("pitch")) {
    db.run(
      sql.raw(
        `ALTER TABLE jobs ADD COLUMN pitch TEXT NOT NULL DEFAULT '${DEFAULT_TTS_PITCH}'`,
      ),
    );
  }
}
