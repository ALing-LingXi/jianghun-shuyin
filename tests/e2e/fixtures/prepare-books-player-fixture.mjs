import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const root = process.cwd();
const storageDir = path.join(root, "storage");
const partsDir = path.join(storageDir, "parts");
const sourcesDir = path.join(storageDir, "sources");
const dbPath = path.join(storageDir, "jianghun-shuyin.db");
const sourcePath = path.join(sourcesDir, "playwright-library-source.txt");
const audioOnePath = path.join(partsDir, "playwright-part-1.mp3");
const audioTwoPath = path.join(partsDir, "playwright-part-2.mp3");

fs.mkdirSync(partsDir, { recursive: true });
fs.mkdirSync(sourcesDir, { recursive: true });
fs.writeFileSync(sourcePath, "Chapter 1\nFixture text.", "utf8");
fs.writeFileSync(audioOnePath, Buffer.from("FAKE-MP3-DATA-ONE"));
fs.writeFileSync(audioTwoPath, Buffer.from("FAKE-MP3-DATA-TWO"));

const db = new Database(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  source_path TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY NOT NULL,
  book_id TEXT NOT NULL REFERENCES books(id),
  status TEXT NOT NULL,
  stage TEXT NOT NULL,
  progress INTEGER NOT NULL,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS parts (
  id TEXT PRIMARY KEY NOT NULL,
  book_id TEXT NOT NULL REFERENCES books(id),
  part_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  audio_path TEXT,
  duration_seconds INTEGER,
  status TEXT NOT NULL
);
`);

const bookId = "11111111-1111-4111-8111-111111111111";
const jobId = "22222222-2222-4222-8222-222222222222";
const partOneId = "33333333-3333-4333-8333-333333333333";
const partTwoId = "44444444-4444-4444-8444-444444444444";
const createdAt = Date.parse("2026-08-12T00:00:00.000Z");

const transaction = db.transaction(() => {
  db.prepare("DELETE FROM parts WHERE id IN (?, ?)").run(partOneId, partTwoId);
  db.prepare("DELETE FROM jobs WHERE id = ?").run(jobId);
  db.prepare("DELETE FROM books WHERE id = ?").run(bookId);

  db.prepare(
    "INSERT INTO books (id, title, author, source_path, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(bookId, "Test Book", "Lin", sourcePath, "completed", createdAt);

  db.prepare(
    "INSERT INTO jobs (id, book_id, status, stage, progress, error_message, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(jobId, bookId, "completed", "completed", 100, null, createdAt, createdAt);

  db.prepare(
    "INSERT INTO parts (id, book_id, part_index, title, audio_path, duration_seconds, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(partOneId, bookId, 0, "Chapter 1", audioOnePath, 120, "completed");

  db.prepare(
    "INSERT INTO parts (id, book_id, part_index, title, audio_path, duration_seconds, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(partTwoId, bookId, 1, "Chapter 2", audioTwoPath, 180, "completed");
});

transaction();
db.close();
