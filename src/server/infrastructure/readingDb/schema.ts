import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const readingBooks = sqliteTable("reading_books", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  author: text("author"),
  sourcePath: text("source_path").notNull(),
  coverPath: text("cover_path").notNull(),
  status: text("status").notNull(),
  currentChapterIndex: integer("current_chapter_index").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const readingChapters = sqliteTable("reading_chapters", {
  id: text("id").primaryKey(),
  bookId: text("book_id")
    .notNull()
    .references(() => readingBooks.id),
  index: integer("chapter_index").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
});
