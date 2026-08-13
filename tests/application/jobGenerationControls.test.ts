import { afterEach, describe, expect, it } from "vitest";
import { pauseJobGeneration } from "../../src/server/application/pauseJobGeneration";
import { resumeJobGeneration } from "../../src/server/application/resumeJobGeneration";
import {
  createDatabaseClient,
  DrizzleBookRepository,
  DrizzleJobRepository,
  DrizzlePartRepository,
  initializeDatabase,
} from "../../src/server/infrastructure/db";

const clients: ReturnType<typeof createDatabaseClient>[] = [];

afterEach(() => {
  for (const client of clients.splice(0)) {
    client.sqlite.close();
  }
});

async function createContext() {
  const client = createDatabaseClient(":memory:");
  initializeDatabase(client.db);
  clients.push(client);

  const books = new DrizzleBookRepository(client.db);
  const jobs = new DrizzleJobRepository(client.db);
  const parts = new DrizzlePartRepository(client.db);
  const book = await books.create({
    title: "Control Book",
    sourcePath: "storage/sources/control.txt",
  });

  return { books, jobs, parts, book };
}

describe("job generation controls", () => {
  it("pauses queued and processing jobs", async () => {
    const context = await createContext();
    const queued = await context.jobs.create({
      bookId: context.book.id,
      voice: "zh-CN-YunxiNeural",
      rate: "+0%",
      pitch: "+0Hz",
      status: "queued",
    });
    const processing = await context.jobs.create({
      bookId: context.book.id,
      voice: "zh-CN-YunxiNeural",
      rate: "+0%",
      pitch: "+0Hz",
      status: "processing",
    });

    await expect(
      pauseJobGeneration(context, { jobId: queued.id }),
    ).resolves.toMatchObject({ status: "paused" });
    await expect(
      pauseJobGeneration(context, { jobId: processing.id }),
    ).resolves.toMatchObject({ status: "paused" });
  });

  it("rejects pausing terminal jobs", async () => {
    const context = await createContext();
    const job = await context.jobs.create({
      bookId: context.book.id,
      voice: "zh-CN-YunxiNeural",
      rate: "+0%",
      pitch: "+0Hz",
      status: "completed",
      stage: "completed",
      progress: 100,
    });

    await expect(
      pauseJobGeneration(context, { jobId: job.id }),
    ).rejects.toMatchObject({
      code: "JOB_NOT_PAUSABLE",
    });
  });

  it("resumes paused jobs from pending parts", async () => {
    const context = await createContext();
    const job = await context.jobs.create({
      bookId: context.book.id,
      voice: "zh-CN-YunxiNeural",
      rate: "+0%",
      pitch: "+0Hz",
      status: "paused",
      stage: "tts",
      progress: 85,
    });
    await context.parts.create({
      bookId: context.book.id,
      index: 0,
      title: "Chapter 1",
      status: "pending",
    });

    await expect(
      resumeJobGeneration(context, { jobId: job.id }),
    ).resolves.toMatchObject({
      status: "processing",
      stage: "tts",
    });
  });

  it("does not retry failed parts when resuming", async () => {
    const context = await createContext();
    const job = await context.jobs.create({
      bookId: context.book.id,
      voice: "zh-CN-YunxiNeural",
      rate: "+0%",
      pitch: "+0Hz",
      status: "paused",
      stage: "tts",
      progress: 95,
    });
    const failedPart = await context.parts.create({
      bookId: context.book.id,
      index: 0,
      title: "Chapter 1",
      status: "failed",
    });

    await expect(
      resumeJobGeneration(context, { jobId: job.id }),
    ).resolves.toMatchObject({
      status: "completed_with_errors",
      stage: "completed",
    });
    await expect(context.parts.findById(failedPart.id)).resolves.toMatchObject({
      status: "failed",
    });
  });

  it("rejects resuming non-paused jobs", async () => {
    const context = await createContext();
    const job = await context.jobs.create({
      bookId: context.book.id,
      voice: "zh-CN-YunxiNeural",
      rate: "+0%",
      pitch: "+0Hz",
      status: "processing",
    });

    await expect(
      resumeJobGeneration(context, { jobId: job.id }),
    ).rejects.toMatchObject({
      code: "JOB_NOT_PAUSED",
    });
  });
});
