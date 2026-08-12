import { beforeEach, describe, expect, it, vi } from "vitest";

const { createBookJob } = vi.hoisted(() => ({
  createBookJob: vi.fn(),
}));

vi.mock("../src/server/composition/container", () => ({
  createContainer: () => ({
    createBookJob,
  }),
}));

import { POST } from "../src/app/api/uploads/file/route";

const bookId = "11111111-1111-4111-8111-111111111111";
const jobId = "22222222-2222-4222-8222-222222222222";

function createRequest(
  file: File,
  overrides: Record<string, string> = {},
): Request {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("title", overrides.title ?? "Test Book");
  formData.set("voice", overrides.voice ?? "zh-CN-XiaoxiaoNeural");
  formData.set("rate", overrides.rate ?? "+0%");
  formData.set("pitch", overrides.pitch ?? "+0Hz");

  return new Request("http://localhost/api/uploads/file", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/uploads/file", () => {
  beforeEach(() => {
    createBookJob.mockReset();
  });

  it("creates a queued job from a valid TXT file without decoding its bytes", async () => {
    createBookJob.mockResolvedValueOnce({ bookId, jobId });
    const source = new Uint8Array([0xff, 0xfe, 0x81, 0x40]);
    const file = new File([source], "novel.txt", { type: "text/plain" });

    const response = await POST(createRequest(file));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ bookId, jobId });
    expect(createBookJob).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Test Book",
        fileName: "novel.txt",
        source,
      }),
    );
  });

  it("rejects non-TXT and empty files", async () => {
    const epub = new File(["not a txt"], "novel.epub", {
      type: "application/epub+zip",
    });
    const emptyTxt = new File([], "empty.txt", { type: "text/plain" });

    const invalidTypeResponse = await POST(createRequest(epub));
    const emptyResponse = await POST(createRequest(emptyTxt));

    expect(invalidTypeResponse.status).toBe(400);
    await expect(invalidTypeResponse.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
    expect(emptyResponse.status).toBe(400);
    await expect(emptyResponse.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
    expect(createBookJob).not.toHaveBeenCalled();
  });

  it("rejects files over 20MB before creating a job", async () => {
    const oversized = new File(
      [new Uint8Array(20 * 1024 * 1024 + 1)],
      "oversized.txt",
      { type: "text/plain" },
    );

    const response = await POST(createRequest(oversized));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
    expect(createBookJob).not.toHaveBeenCalled();
  });
});
