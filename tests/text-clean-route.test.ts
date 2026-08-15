import { describe, expect, it, vi } from "vitest";

const { cleanTextFile } = vi.hoisted(() => ({
  cleanTextFile: vi.fn(),
}));

vi.mock("../src/server/application/cleanTextFile", () => ({
  cleanTextFile,
}));

import { POST } from "../src/app/api/tools/text-clean/route";

function createRequest(file: File): Request {
  const formData = new FormData();
  formData.set("file", file);

  return new Request("http://localhost/api/tools/text-clean", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/tools/text-clean", () => {
  it("returns a downloadable cleaned txt response", async () => {
    cleanTextFile.mockReturnValueOnce({
      text: "第一行\n第二行",
      downloadFileName: "web机翻 在男子禁止的游戏世界里，我唯一该做的事情.cleaned.txt",
      encoding: "utf-8",
      byteLength: 24,
      originalCharacters: 12,
      cleanedCharacters: 8,
      removedBom: true,
      normalizedNewlineCount: 1,
      collapsedBlankLineCount: 1,
      trimmedBlankLineCount: 0,
    });

    const file = new File(
      [new TextEncoder().encode("\uFEFF第一行\r\n\r\n***\r\n第二行\r\n")],
      "web机翻 在男子禁止的游戏世界里，我唯一该做的事情.txt",
      { type: "text/plain" },
    );

    const response = await POST(createRequest(file));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(response.headers.get("x-download-file-name")).toBe(
      encodeURIComponent(
        "web机翻 在男子禁止的游戏世界里，我唯一该做的事情.cleaned.txt",
      ),
    );
    expect(response.headers.get("content-disposition")).toContain(
      "filename*=UTF-8''",
    );
    await expect(response.text()).resolves.toBe("第一行\n第二行");
  });

  it("returns diagnostic detail when cleaning fails", async () => {
    cleanTextFile.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    const file = new File(["dirty"], "dirty.txt", { type: "text/plain" });
    const response = await POST(createRequest(file));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "TEXT_CLEAN_FAILED",
        detail: "boom",
      },
    });
  });
});
