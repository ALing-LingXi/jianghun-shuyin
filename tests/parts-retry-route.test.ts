import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Part } from "../src/server/domain/entities";
import { RetryPartError } from "../src/server/application/retryPart";

const { retryPart } = vi.hoisted(() => ({
  retryPart: vi.fn(),
}));

vi.mock("../src/server/composition/container", () => ({
  createContainer: () => ({
    retryPart,
  }),
}));

import { POST } from "../src/app/api/parts/[partId]/retry/route";

const partId = "11111111-1111-4111-8111-111111111111";

function createPart(overrides: Partial<Part> = {}): Part {
  return {
    id: partId,
    bookId: "22222222-2222-4222-8222-222222222222",
    index: 0,
    title: "Chapter 1",
    audioPath: null,
    durationSeconds: null,
    status: "pending",
    ...overrides,
  };
}

describe("POST /api/parts/[partId]/retry", () => {
  beforeEach(() => {
    retryPart.mockReset();
  });

  it("returns the reset part", async () => {
    retryPart.mockResolvedValueOnce(createPart());

    const response = await POST(
      new Request(`http://localhost/api/parts/${partId}/retry`, {
        method: "POST",
      }),
      {
        params: Promise.resolve({ partId }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: partId,
      status: "pending",
    });
  });

  it("returns 400 for invalid part ids", async () => {
    const response = await POST(
      new Request("http://localhost/api/parts/not-a-uuid/retry", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ partId: "not-a-uuid" }),
      },
    );

    expect(response.status).toBe(400);
    expect(retryPart).not.toHaveBeenCalled();
  });

  it("returns 409 when the part cannot be retried", async () => {
    retryPart.mockRejectedValueOnce(
      new RetryPartError("PART_NOT_FAILED", "Only failed parts can be retried"),
    );

    const response = await POST(
      new Request(`http://localhost/api/parts/${partId}/retry`, {
        method: "POST",
      }),
      {
        params: Promise.resolve({ partId }),
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "PART_NOT_FAILED" },
    });
  });
});
