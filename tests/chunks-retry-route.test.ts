import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Chunk } from "../src/server/domain/entities";
import { RetryChunkError } from "../src/server/application/retryChunk";

const { retryChunk } = vi.hoisted(() => ({
  retryChunk: vi.fn(),
}));

vi.mock("../src/server/composition/container", () => ({
  createContainer: () => ({
    retryChunk,
  }),
}));

import { POST } from "../src/app/api/chunks/[chunkId]/retry/route";

function createChunk(overrides: Partial<Chunk> = {}): Chunk {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    partId: "22222222-2222-4222-8222-222222222222",
    index: 0,
    textHash: "cache-key",
    audioPath: "storage/chunks/retry.mp3",
    status: "completed",
    retryCount: 1,
    errorMessage: null,
    ...overrides,
  };
}

function createRequest(body: unknown): Request {
  return new Request("http://localhost/api/chunks/chunk-id/retry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  text: "retry this sentence.",
  voice: "voice-a",
  rate: "+0%",
  pitch: "+0Hz",
};

describe("POST /api/chunks/[chunkId]/retry", () => {
  beforeEach(() => {
    retryChunk.mockReset();
  });

  it("returns the retried chunk", async () => {
    retryChunk.mockResolvedValueOnce(createChunk());

    const response = await POST(createRequest(validBody), {
      params: Promise.resolve({
        chunkId: "11111111-1111-4111-8111-111111111111",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "completed",
      retryCount: 1,
    });
  });

  it("returns 400 for invalid input", async () => {
    const response = await POST(createRequest({ ...validBody, text: "" }), {
      params: Promise.resolve({ chunkId: "not-a-uuid" }),
    });

    expect(response.status).toBe(400);
    expect(retryChunk).not.toHaveBeenCalled();
  });

  it("returns 404 when the chunk does not exist", async () => {
    retryChunk.mockRejectedValueOnce(
      new RetryChunkError("CHUNK_NOT_FOUND", "Chunk not found"),
    );

    const response = await POST(createRequest(validBody), {
      params: Promise.resolve({
        chunkId: "11111111-1111-4111-8111-111111111111",
      }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "CHUNK_NOT_FOUND" },
    });
  });
});
