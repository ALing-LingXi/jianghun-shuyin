import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchJob,
  getJobPollingInterval,
  JobApiError,
  JOB_POLLING_INTERVAL_MS,
} from "../src/features/job/hooks/useJobPolling";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("job polling", () => {
  it("keeps polling active jobs", () => {
    expect(getJobPollingInterval()).toBe(JOB_POLLING_INTERVAL_MS);
    expect(getJobPollingInterval("queued")).toBe(JOB_POLLING_INTERVAL_MS);
    expect(getJobPollingInterval("processing")).toBe(JOB_POLLING_INTERVAL_MS);
  });

  it("stops polling terminal jobs", () => {
    expect(getJobPollingInterval("completed")).toBe(false);
    expect(getJobPollingInterval("completed_with_errors")).toBe(false);
    expect(getJobPollingInterval("paused")).toBe(false);
    expect(getJobPollingInterval("failed")).toBe(false);
    expect(getJobPollingInterval("cancelled")).toBe(false);
  });

  it("logs API failures with stable error details", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "JOB_NOT_FOUND",
            message: "Job not found",
          },
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(
      fetchJob("11111111-1111-4111-8111-111111111111"),
    ).rejects.toBeInstanceOf(JobApiError);

    expect(consoleError).toHaveBeenCalledWith("[job] request failed", {
      jobId: "11111111-1111-4111-8111-111111111111",
      status: 404,
      code: "JOB_NOT_FOUND",
      message: "Job not found",
    });
  });
});
