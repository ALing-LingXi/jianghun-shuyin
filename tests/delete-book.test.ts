import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteBook } from "../src/server/application/deleteBook";
import {
  createDatabaseClient,
  DrizzleBookRepository,
  DrizzleChunkRepository,
  DrizzleJobRepository,
  DrizzlePartRepository,
  initializeDatabase,
} from "../src/server/infrastructure/db";
import { LocalStorage } from "../src/server/infrastructure/localStorage";

const clients: ReturnType<typeof createDatabaseClient>[] = [];
const tempRoots: string[] = [];

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.sqlite.close();
  }

  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("deleteBook", () => {
  it("deletes a book with its jobs, parts, chunks, source file, and audio", async () => {
    const client = createDatabaseClient(":memory:");
    initializeDatabase(client.db);
    clients.push(client);

    const storageRoot = await mkdtemp(path.join(os.tmpdir(), "jianghun-delete-"));
    tempRoots.push(storageRoot);
    const sourcePath = path.join(storageRoot, "sources", "book.txt");
    const unrelatedCleanedPath = path.join(
      storageRoot,
      "cleaned",
      "unrelated.cleaned.txt",
    );
    const unrelatedReportPath = path.join(
      storageRoot,
      "reports",
      "unrelated.report.json",
    );
    const partAudioPath = path.join(storageRoot, "parts", "part.mp3");
    const chunkAudioPath = path.join(storageRoot, "chunks", "chunk.mp3");
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await mkdir(path.dirname(unrelatedCleanedPath), { recursive: true });
    await mkdir(path.dirname(unrelatedReportPath), { recursive: true });
    await mkdir(path.dirname(partAudioPath), { recursive: true });
    await mkdir(path.dirname(chunkAudioPath), { recursive: true });
    await writeFile(sourcePath, "book text", "utf8");
    await writeFile(unrelatedCleanedPath, "cleaned text", "utf8");
    await writeFile(unrelatedReportPath, "{}", "utf8");
    await writeFile(partAudioPath, new Uint8Array([1, 2, 3]));
    await writeFile(chunkAudioPath, new Uint8Array([4, 5, 6]));

    const books = new DrizzleBookRepository(client.db);
    const jobs = new DrizzleJobRepository(client.db);
    const parts = new DrizzlePartRepository(client.db);
    const chunks = new DrizzleChunkRepository(client.db);
    const storage = new LocalStorage(storageRoot);
    const updateJob = vi.spyOn(jobs, "updateById");

    const book = await books.create({
      title: "Test Book",
      sourcePath,
      status: "completed",
    });
    const job = await jobs.create({
      bookId: book.id,
      voice: "zh-CN-YunxiNeural",
      rate: "+0%",
      pitch: "+0Hz",
      status: "processing",
      stage: "tts",
      progress: 85,
    });
    const oldJob = await jobs.create({
      bookId: book.id,
      voice: "zh-CN-YunxiNeural",
      rate: "+0%",
      pitch: "+0Hz",
      status: "completed",
      stage: "completed",
      progress: 100,
    });
    const jobCleanedPath = path.join(
      storageRoot,
      "cleaned",
      `${job.id}.cleaned.txt`,
    );
    const oldJobCleanedPath = path.join(
      storageRoot,
      "cleaned",
      `${oldJob.id}.cleaned.txt`,
    );
    const jobReportPath = path.join(storageRoot, "reports", `${job.id}.report.json`);
    const oldJobReportPath = path.join(
      storageRoot,
      "reports",
      `${oldJob.id}.report.json`,
    );
    await writeFile(jobCleanedPath, "job cleaned text", "utf8");
    await writeFile(oldJobCleanedPath, "old job cleaned text", "utf8");
    await writeFile(jobReportPath, "{}", "utf8");
    await writeFile(oldJobReportPath, "{}", "utf8");
    const part = await parts.create({
      bookId: book.id,
      index: 0,
      title: "Chapter 1",
      audioPath: partAudioPath,
      status: "completed",
    });
    await chunks.create({
      partId: part.id,
      index: 0,
      textHash: "voice-rate-pitch-text",
      audioPath: chunkAudioPath,
      status: "completed",
    });

    await expect(
      deleteBook({ books, chunks, jobs, parts, storage }, book.id),
    ).resolves.toEqual({ deleted: true });

    expect(updateJob).toHaveBeenCalledWith(job.id, {
      status: "cancelled",
      errorMessage: "Book was deleted.",
    });
    await expect(books.findById(book.id)).resolves.toBeNull();
    await expect(jobs.findLatestByBookId(book.id)).resolves.toBeNull();
    await expect(parts.listByBookId(book.id)).resolves.toEqual([]);
    await expect(chunks.listByPartId(part.id)).resolves.toEqual([]);
    await expect(readFile(sourcePath)).rejects.toThrow();
    await expect(readFile(jobCleanedPath)).rejects.toThrow();
    await expect(readFile(oldJobCleanedPath)).rejects.toThrow();
    await expect(readFile(jobReportPath)).rejects.toThrow();
    await expect(readFile(oldJobReportPath)).rejects.toThrow();
    await expect(readFile(partAudioPath)).rejects.toThrow();
    await expect(readFile(chunkAudioPath)).rejects.toThrow();
    await expect(readFile(unrelatedCleanedPath, "utf8")).resolves.toBe(
      "cleaned text",
    );
    await expect(readFile(unrelatedReportPath, "utf8")).resolves.toBe("{}");
  });

  it("returns a not-deleted result when the book is missing", async () => {
    const client = createDatabaseClient(":memory:");
    initializeDatabase(client.db);
    clients.push(client);

    const storageRoot = await mkdtemp(path.join(os.tmpdir(), "jianghun-delete-"));
    tempRoots.push(storageRoot);

    const books = new DrizzleBookRepository(client.db);
    const jobs = new DrizzleJobRepository(client.db);
    const parts = new DrizzlePartRepository(client.db);
    const chunks = new DrizzleChunkRepository(client.db);
    const storage = new LocalStorage(storageRoot);

    await expect(
      deleteBook({ books, chunks, jobs, parts, storage }, "missing-book"),
    ).resolves.toEqual({ deleted: false });
  });

  it("ignores missing generated files while deleting records", async () => {
    const client = createDatabaseClient(":memory:");
    initializeDatabase(client.db);
    clients.push(client);

    const storageRoot = await mkdtemp(path.join(os.tmpdir(), "jianghun-delete-"));
    tempRoots.push(storageRoot);
    const sourcePath = path.join(storageRoot, "sources", "book.txt");
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, "book text", "utf8");

    const books = new DrizzleBookRepository(client.db);
    const jobs = new DrizzleJobRepository(client.db);
    const parts = new DrizzlePartRepository(client.db);
    const chunks = new DrizzleChunkRepository(client.db);
    const storage = new LocalStorage(storageRoot);

    const book = await books.create({
      title: "Missing files",
      sourcePath,
    });
    await jobs.create({
      bookId: book.id,
      voice: "zh-CN-YunxiNeural",
      rate: "+0%",
      pitch: "+0Hz",
    });
    const part = await parts.create({
      bookId: book.id,
      index: 0,
      title: "Chapter 1",
      audioPath: path.join(storageRoot, "parts", "missing.mp3"),
      status: "completed",
    });
    await chunks.create({
      partId: part.id,
      index: 0,
      textHash: "hash",
      audioPath: path.join(storageRoot, "chunks", "missing.mp3"),
      status: "completed",
    });

    await expect(
      deleteBook({ books, chunks, jobs, parts, storage }, book.id),
    ).resolves.toEqual({ deleted: true });

    await expect(books.findById(book.id)).resolves.toBeNull();
    await expect(parts.listByBookId(book.id)).resolves.toEqual([]);
    await expect(jobs.listByBookId(book.id)).resolves.toEqual([]);
  });
});
