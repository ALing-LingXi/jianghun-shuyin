import { describe, expect, it } from "vitest";
import { createHealthResponse } from "../src/shared/health";

describe("createHealthResponse", () => {
  it("returns a stable health payload", () => {
    const response = createHealthResponse(new Date("2026-01-02T03:04:05.000Z"));

    expect(response).toEqual({
      status: "ok",
      service: "jianghun-shuyin",
      timestamp: "2026-01-02T03:04:05.000Z",
    });
  });
});
