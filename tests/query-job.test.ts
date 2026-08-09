import { afterEach, describe, expect, it } from "vitest";
import { queryJob } from "../src/server/application/queryJob";
import {
  createDatabaseClient,
  DrizzleBookRepository,
  DrizzleJobRepository,
  initializeDatabase,
} from "../src/server/infrastructure/db";

const clients: ReturnType<typeof createDatabaseClient>[] = [];

afterEach(() => {
  for (const client of clients.splice(0)) {
    client.sqlite.close();
  }
});

describe("queryJob", () => {
  it("returns a job when it exists", async () => {
    const client = createDatabaseClient(":memory:");
    initializeDatabase(client.db);
    clients.push(client);

    const books = new DrizzleBookRepository(client.db);
    const jobs = new DrizzleJobRepository(client.db);
    const book = await books.create({
      title: "三体",
      sourcePath: "storage/sources/three-body.txt",
    });
    const created = await jobs.create({ bookId: book.id });

    await expect(queryJob({ jobs }, created.id)).resolves.toEqual(created);
  });

  it("returns null when the job is missing", async () => {
    const client = createDatabaseClient(":memory:");
    initializeDatabase(client.db);
    clients.push(client);

    const jobs = new DrizzleJobRepository(client.db);

    await expect(queryJob({ jobs }, "missing-job")).resolves.toBeNull();
  });
});
