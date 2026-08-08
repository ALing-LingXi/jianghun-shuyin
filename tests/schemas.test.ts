import { describe, expect, it } from "vitest";
import {
  bookSchema,
  createJobSchema,
  jobSchema,
  playerSchema,
  uploadTextSchema,
  uploadSchema,
} from "../src/shared/schemas";

const bookId = "a8b8a92c-7d3f-4a11-82b5-494c89a406bd";
const jobId = "8bba0ac8-4804-4413-b7b4-e5f6b925e2d4";
const createdAt = "2026-08-07T08:00:00.000Z";

describe("shared schemas", () => {
  it("accepts valid book and job DTOs", () => {
    expect(
      bookSchema.parse({
        id: bookId,
        title: "三体",
        author: "刘慈欣",
        sourcePath: "storage/sources/three-body.txt",
        status: "pending",
        createdAt,
      }),
    ).toMatchObject({ id: bookId, title: "三体" });

    expect(
      jobSchema.parse({
        id: jobId,
        bookId,
        status: "queued",
        stage: "decoding",
        progress: 0,
        errorMessage: null,
        createdAt,
        updatedAt: createdAt,
      }),
    ).toMatchObject({ id: jobId, status: "queued" });
  });

  it("rejects invalid job progress and missing upload content", () => {
    expect(() =>
      createJobSchema.parse({
        bookId,
        progress: 101,
      }),
    ).toThrow();

    expect(() =>
      uploadSchema.parse({
        title: "三体",
        voice: "zh-CN-XiaoxiaoNeural",
        rate: "+0%",
        pitch: "+0Hz",
      }),
    ).toThrow();
  });

  it("accepts text upload input and rejects blank text", () => {
    expect(
      uploadTextSchema.parse({
        title: "三体",
        text: "这是正文。",
        voice: "zh-CN-XiaoxiaoNeural",
        rate: "+0%",
        pitch: "+0Hz",
      }),
    ).toMatchObject({ title: "三体", text: "这是正文。" });

    expect(() =>
      uploadTextSchema.parse({
        title: "三体",
        text: "   ",
        voice: "zh-CN-XiaoxiaoNeural",
        rate: "+0%",
        pitch: "+0Hz",
      }),
    ).toThrow();
  });

  it("accepts a player with playable parts", () => {
    expect(
      playerSchema.parse({
        bookId,
        parts: [
          {
            id: "c53a96af-2a92-4fc0-8989-9d1fa1f9f3bd",
            index: 0,
            title: "第一章",
            audioUrl: "http://localhost:3000/audio/part-1.mp3",
            durationSeconds: 62,
          },
        ],
      }),
    ).toMatchObject({ bookId });
  });
});
