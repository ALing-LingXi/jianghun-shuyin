import { describe, expect, it } from "vitest";
import {
  getJobPollingInterval,
  JOB_POLLING_INTERVAL_MS,
} from "../src/features/job/hooks/useJobPolling";

describe("job polling", () => {
  it("keeps polling active jobs", () => {
    expect(getJobPollingInterval()).toBe(JOB_POLLING_INTERVAL_MS);
    expect(getJobPollingInterval("queued")).toBe(JOB_POLLING_INTERVAL_MS);
    expect(getJobPollingInterval("processing")).toBe(JOB_POLLING_INTERVAL_MS);
  });

  it("stops polling terminal jobs", () => {
    expect(getJobPollingInterval("completed")).toBe(false);
    expect(getJobPollingInterval("failed")).toBe(false);
    expect(getJobPollingInterval("cancelled")).toBe(false);
  });
});
