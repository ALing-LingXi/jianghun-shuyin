import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "../src/server/domain/entities";

const { queryJob } = vi.hoisted(() => ({
  queryJob: vi.fn(),
}));

vi.mock("../src/server/composition/container", () => ({
  createContainer: () => ({
    queryJob,
  }),
}));

import { GET } from "../src/app/api/jobs/[jobId]/route";

function createJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    bookId: "22222222-2222-4222-8222-222222222222",
    voice: "zh-CN-YunxiNeural",
    rate: "+0%",
    pitch: "+0Hz",
    status: "queued",
    stage: "decoding",
    progress: 0,
    errorMessage: null,
    createdAt: new Date("2026-08-09T00:00:00.000Z"),
    updatedAt: new Date("2026-08-09T00:00:00.000Z"),
    ...overrides,
  };
}

describe("GET /api/jobs/[jobId]", () => {
  beforeEach(() => {
    queryJob.mockReset();
  });

  it("returns a job dto", async () => {
    queryJob.mockResolvedValueOnce({
      ...createJob(),
      parts: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          index: 0,
          title: "第一章 风起",
          status: "completed",
          durationSeconds: 120,
        },
      ],
    });

    const response = await GET(new Request("http://localhost/api/jobs/1"), {
      params: Promise.resolve({
        jobId: "11111111-1111-4111-8111-111111111111",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      voice: "zh-CN-YunxiNeural",
      status: "queued",
      stage: "decoding",
      progress: 0,
      parts: [
        {
          title: "第一章 风起",
          status: "completed",
        },
      ],
    });
  });

  it("returns 404 for missing jobs", async () => {
    queryJob.mockResolvedValueOnce(null);

    const response = await GET(new Request("http://localhost/api/jobs/1"), {
      params: Promise.resolve({
        jobId: "11111111-1111-4111-8111-111111111111",
      }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "JOB_NOT_FOUND" },
    });
  });

  it("returns 400 for invalid job ids", async () => {
    const response = await GET(new Request("http://localhost/api/jobs/1"), {
      params: Promise.resolve({ jobId: "not-a-uuid" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
  });
});
