import { describe, expect, it } from "vitest";
import {
  buildReport,
  cleanText,
  decodeText,
  detectChapters,
  planParts,
} from "../../src/server/pipeline";

describe("text pipeline", () => {
  it("decodes UTF-8 text and UTF-8 BOM text", () => {
    const text = "第一章 开始\n这是正文。";
    const utf8 = new TextEncoder().encode(text);
    const utf8WithBom = Uint8Array.from([0xef, 0xbb, 0xbf, ...utf8]);

    expect(decodeText(utf8)).toMatchObject({
      text,
      encoding: "utf-8",
      hadBom: false,
    });
    expect(decodeText(utf8WithBom)).toMatchObject({
      text,
      encoding: "utf-8",
      hadBom: true,
    });
  });

  it("decodes GBK and Big5 text with runtime supported encodings", () => {
    const gbk = Uint8Array.from([0xc4, 0xe3, 0xba, 0xc3]);
    const big5 = Uint8Array.from([0xa7, 0x41, 0xa6, 0x6e]);

    expect(decodeText(gbk)).toMatchObject({
      encoding: "gbk",
    });
    expect(decodeText(big5, { preferredEncoding: "big5" })).toMatchObject({
      encoding: "big5",
    });
  });

  it("cleans layout noise without deleting ordinary prose", () => {
    const result = cleanText("\uFEFF\r\n  第一行正文。 \r\n\r\n\r\n第二行正文。\r\n");

    expect(result.text).toBe("  第一行正文。\n\n第二行正文。");
    expect(result.removedBom).toBe(true);
    expect(result.normalizedNewlineCount).toBeGreaterThan(0);
    expect(result.collapsedBlankLineCount).toBe(1);
    expect(result.trimmedBlankLineCount).toBe(2);
  });

  it("removes decorative lines and escaped tab noise conservatively", () => {
    const result = cleanText(
      [
        "第一章 风起",
        "****",
        "他说：密码是 ****。",
        "A\t\t\tB",
        "C\\t\\t\\tD",
        "E/t/t/tF",
        "------",
        "======",
        "＿＿＿＿",
        "normal prose",
      ].join("\n"),
    );

    expect(result.text).toBe(
      [
        "第一章 风起",
        "他说：密码是 ****。",
        "A B",
        "C D",
        "E F",
        "normal prose",
      ].join("\n"),
    );
  });

  it("detects common chapter headings", () => {
    const result = detectChapters(
      [
        "第一章 风起",
        "雨落在青石街上。",
        "",
        "第二章 灯火",
        "客栈的灯还亮着。",
        "",
        "Chapter 3: Return",
        "The road bends.",
      ].join("\n"),
    );

    expect(result.detectedHeadingCount).toBe(3);
    expect(result.chapters).toHaveLength(3);
    expect(result.chapters.map((chapter) => chapter.title)).toEqual([
      "第一章 风起",
      "第二章 灯火",
      "Chapter 3: Return",
    ]);
  });

  it("does not mistake normal prose for a chapter heading", () => {
    const result = detectChapters(
      "他低声说：第一章并不是故事的开始。\n风还在吹。",
    );

    expect(result.chapters).toEqual([]);
    expect(result.detectedHeadingCount).toBe(0);
  });

  it("falls back to one planned part when no chapters are detected", () => {
    const text = "这是一段没有章节标题的正文。\n它仍然应该可以规划。";
    const chapters = detectChapters(text);
    const plan = planParts(text, chapters.chapters);

    expect(plan.fallbackUsed).toBe(true);
    expect(plan.parts).toHaveLength(1);
    expect(plan.parts[0]).toMatchObject({
      index: 0,
      chapterIndex: 0,
      text,
    });
  });

  it("keeps oversized chapters as one chapter-level part", () => {
    const text = `第一章 长章\n${"这是一句很长的正文。".repeat(24)}`;
    const chapters = detectChapters(text);
    const plan = planParts(text, chapters.chapters, {
      maxPartCharacters: 40,
      estimatedCharactersPerSecond: 4,
    });

    expect(plan.fallbackUsed).toBe(false);
    expect(plan.parts).toHaveLength(1);
    expect(plan.parts[0]).toMatchObject({
      title: "第一章 长章",
      segmentIndex: 0,
      segmentCount: 1,
    });
    expect(plan.parts[0].characterCount).toBeGreaterThan(40);
  });

  it("handles empty boundaries without throwing", () => {
    const decoded = decodeText(new Uint8Array());
    const cleaned = cleanText(decoded.text);
    const chapters = detectChapters(cleaned.text);
    const plan = planParts(cleaned.text, chapters.chapters);

    expect(decoded.text).toBe("");
    expect(cleaned.text).toBe("");
    expect(chapters.chapters).toEqual([]);
    expect(plan.parts).toEqual([]);
  });

  it("builds a parse report with stable notices", () => {
    const decoded = decodeText(new TextEncoder().encode("没有章节的正文。"));
    const cleaned = cleanText(decoded.text);
    const chapters = detectChapters(cleaned.text);
    const plan = planParts(cleaned.text, chapters.chapters);

    expect(
      buildReport({
        decode: decoded,
        clean: cleaned,
        chapters,
        plan,
      }),
    ).toMatchObject({
      encoding: "utf-8",
      chapterCount: 0,
      partCount: 1,
      fallbackUsed: true,
      notices: ["fallback_single_chapter"],
    });
  });
});
