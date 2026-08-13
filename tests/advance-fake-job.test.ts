import { describe, expect, it } from "vitest";
import { advanceFakeJob } from "../src/server/application/advanceFakeJob";
import type { Job } from "../src/server/domain/entities";

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
    createdAt: new Date("2026-08-10T00:00:00.000Z"),
    updatedAt: new Date("2026-08-10T00:00:00.000Z"),
    ...overrides,
  };
}

describe("advanceFakeJob", () => {
  it("moves queued jobs into processing", () => {
    expect(advanceFakeJob(createJob())).toMatchObject({
      status: "processing",
      stage: "decoding",
      progress: 10,
      errorMessage: null,
    });
  });

  it("moves processing jobs to completed after fake stages", () => {
    let current = createJob({ status: "processing" });

    for (let step = 0; step < 6; step += 1) {
      const next = advanceFakeJob(current);
      expect(next).not.toBeNull();
      current = createJob({
        status: next?.status,
        stage: next?.stage,
        progress: next?.progress,
      });
    }

    expect(current).toMatchObject({
      status: "completed",
      stage: "completed",
      progress: 100,
    });
  });

  it("does not advance terminal jobs", () => {
    expect(
      advanceFakeJob(
        createJob({
          status: "completed",
          stage: "completed",
          progress: 100,
        }),
      ),
    ).toBeNull();
  });

  it("does not advance paused jobs", () => {
    expect(
      advanceFakeJob(
        createJob({
          status: "paused",
          stage: "tts",
          progress: 85,
        }),
      ),
    ).toBeNull();
  });
});
