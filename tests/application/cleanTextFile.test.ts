import { describe, expect, it } from "vitest";
import { cleanTextFile } from "../../src/server/application/cleanTextFile";

describe("cleanTextFile", () => {
  it("cleans dirty txt bytes and prepares a download name", () => {
    const result = cleanTextFile({
      fileName: "web机翻 在男子禁止的游戏世界里，我唯一该做的事情.txt",
      source: new TextEncoder().encode("\uFEFF第一行\r\n\r\n***\r\n第二\t\t行\r\n"),
    });

    expect(result).toMatchObject({
      text: "第一行\n\n第二 行",
      downloadFileName:
        "web机翻 在男子禁止的游戏世界里，我唯一该做的事情.cleaned.txt",
      encoding: "utf-8",
      removedBom: true,
    });
    expect(result.normalizedNewlineCount).toBeGreaterThan(0);
    expect(result.collapsedBlankLineCount).toBe(0);
  });
});
