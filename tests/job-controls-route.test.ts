import { beforeEach, describe, expect, it, vi } from "vitest";
import { PauseJobGenerationError } from "../src/server/application/pauseJobGeneration";
import { ResumeJobGenerationError } from "../src/server/application/resumeJobGeneration";
import type { Job } from "../src/server/domain/entities";

const { pauseJobGeneration, resumeJobGeneration } = vi.hoisted(() => ({
  pauseJobGeneration: vi.fn(),
  resumeJobGeneration: vi.fn(),
}));

vi.mock("../src/server/composition/container", () => ({
  createContainer: () => ({
    pauseJobGeneration,
    resumeJobGeneration,
  }),
}));

import { POST as pausePost } from "../src/app/api/jobs/[jobId]/pause/route";
import { POST as resumePost } from "../src/app/api/jobs/[jobId]/resume/route";

function createJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    bookId: "22222222-2222-4222-8222-222222222222",
    voice: "zh-CN-YunxiNeural",
    rate: "+0%",
    pitch: "+0Hz",
    status: "paused",
    stage: "tts",
    progress: 85,
    errorMessage: null,
    createdAt: new Date("2026-08-09T00:00:00.000Z"),
    updatedAt: new Date("2026-08-09T00:00:00.000Z"),
    ...overrides,
  };
}

describe("job generation control routes", () => {
  beforeEach(() => {
    pauseJobGeneration.mockReset();
    resumeJobGeneration.mockReset();
  });

  it("pauses a job", async () => {
    pauseJobGeneration.mockResolvedValueOnce(createJob());

    const response = await pausePost(new Request("http://localhost"), {
      params: Promise.resolve({
        jobId: "11111111-1111-4111-8111-111111111111",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      status: "paused",
    });
  });

  it("resumes a job", async () => {
    resumeJobGeneration.mockResolvedValueOnce(
      createJob({ status: "processing" }),
    );

    const response = await resumePost(new Request("http://localhost"), {
      params: Promise.resolve({
        jobId: "11111111-1111-4111-8111-111111111111",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "processing",
    });
  });

  it("returns stable pause errors", async () => {
    pauseJobGeneration.mockRejectedValueOnce(
      new PauseJobGenerationError(
        "JOB_NOT_PAUSABLE",
        "Only queued or processing jobs can be paused",
      ),
    );

    const response = await pausePost(new Request("http://localhost"), {
      params: Promise.resolve({
        jobId: "11111111-1111-4111-8111-111111111111",
      }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "JOB_NOT_PAUSABLE" },
    });
  });

  it("returns stable resume errors", async () => {
    resumeJobGeneration.mockRejectedValueOnce(
      new ResumeJobGenerationError(
        "JOB_NOT_PAUSED",
        "Only paused jobs can be resumed",
      ),
    );

    const response = await resumePost(new Request("http://localhost"), {
      params: Promise.resolve({
        jobId: "11111111-1111-4111-8111-111111111111",
      }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "JOB_NOT_PAUSED" },
    });
  });
});
