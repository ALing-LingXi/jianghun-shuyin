import { describe, expect, it } from "vitest";
import {
  canPauseJob,
  canResumeJob,
} from "../src/features/job/hooks/useJobControls";

describe("job generation controls", () => {
  it("allows pausing only active jobs", () => {
    expect(canPauseJob({ status: "queued" })).toBe(true);
    expect(canPauseJob({ status: "processing" })).toBe(true);
    expect(canPauseJob({ status: "paused" })).toBe(false);
    expect(canPauseJob({ status: "completed" })).toBe(false);
    expect(canPauseJob({ status: "completed_with_errors" })).toBe(false);
    expect(canPauseJob({ status: "failed" })).toBe(false);
    expect(canPauseJob({ status: "cancelled" })).toBe(false);
  });

  it("allows resuming only paused jobs", () => {
    expect(canResumeJob({ status: "paused" })).toBe(true);
    expect(canResumeJob({ status: "processing" })).toBe(false);
    expect(canResumeJob({ status: "completed" })).toBe(false);
  });
});
