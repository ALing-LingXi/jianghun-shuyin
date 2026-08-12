import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const books = sqliteTable("books", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  author: text("author"),
  sourcePath: text("source_path").notNull(),
  status: text("status").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  bookId: text("book_id")
    .notNull()
    .references(() => books.id),
  voice: text("voice").notNull(),
  rate: text("rate").notNull(),
  pitch: text("pitch").notNull(),
  status: text("status").notNull(),
  stage: text("stage").notNull(),
  progress: integer("progress").notNull(),
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const parts = sqliteTable("parts", {
  id: text("id").primaryKey(),
  bookId: text("book_id")
    .notNull()
    .references(() => books.id),
  index: integer("part_index").notNull(),
  title: text("title").notNull(),
  audioPath: text("audio_path"),
  durationSeconds: integer("duration_seconds"),
  status: text("status").notNull(),
});

export const chunks = sqliteTable("chunks", {
  id: text("id").primaryKey(),
  partId: text("part_id")
    .notNull()
    .references(() => parts.id),
  index: integer("chunk_index").notNull(),
  textHash: text("text_hash").notNull(),
  audioPath: text("audio_path"),
  status: text("status").notNull(),
  retryCount: integer("retry_count").notNull(),
  errorMessage: text("error_message"),
});
