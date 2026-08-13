import { describe, expect, it } from "vitest";
import {
  bookSchema,
  createJobSchema,
  jobSchema,
  playerSchema,
  uploadFileSchema,
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
        title: "Test Book",
        author: "Lin",
        sourcePath: "storage/sources/book.txt",
        status: "pending",
        createdAt,
      }),
    ).toMatchObject({ id: bookId, title: "Test Book" });

    expect(
      jobSchema.parse({
        id: jobId,
        bookId,
        voice: "zh-CN-YunxiNeural",
        rate: "+0%",
        pitch: "+0Hz",
        status: "completed_with_errors",
        stage: "completed",
        progress: 100,
        errorMessage: "1 chapter(s) failed.",
        createdAt,
        updatedAt: createdAt,
        parts: [
          {
            id: "c53a96af-2a92-4fc0-8989-9d1fa1f9f3bd",
            index: 0,
            title: "第一章 风起",
            status: "completed",
            durationSeconds: 120,
          },
        ],
      }),
    ).toMatchObject({
      id: jobId,
      status: "completed_with_errors",
      parts: [{ title: "第一章 风起" }],
    });
  });

  it("rejects invalid job progress and missing upload content", () => {
    expect(
      jobSchema.parse({
        id: jobId,
        bookId,
        voice: "zh-CN-YunxiNeural",
        rate: "+0%",
        pitch: "+0Hz",
        status: "paused",
        stage: "tts",
        progress: 85,
        errorMessage: null,
        createdAt,
        updatedAt: createdAt,
      }),
    ).toMatchObject({ status: "paused", parts: [] });

    expect(() =>
      createJobSchema.parse({
        bookId,
        progress: 101,
      }),
    ).toThrow();

    expect(() =>
      uploadSchema.parse({
        title: "Test Book",
        voice: "zh-CN-XiaoxiaoNeural",
        rate: "+0%",
        pitch: "+0Hz",
      }),
    ).toThrow();
  });

  it("accepts text upload input and rejects blank text", () => {
    expect(
      uploadTextSchema.parse({
        title: "Test Book",
        text: "This is body text.",
        voice: "zh-CN-XiaoxiaoNeural",
        rate: "+0%",
        pitch: "+0Hz",
      }),
    ).toMatchObject({ title: "Test Book", text: "This is body text." });

    expect(() =>
      uploadTextSchema.parse({
        title: "Test Book",
        text: "   ",
        voice: "zh-CN-XiaoxiaoNeural",
        rate: "+0%",
        pitch: "+0Hz",
      }),
    ).toThrow();

    expect(() =>
      uploadTextSchema.parse({
        title: "Test Book",
        text: "This is body text.",
        voice: "am-ET-AmehaNeural",
        rate: "+0%",
        pitch: "+0Hz",
      }),
    ).toThrow();
  });

  it("accepts TXT upload metadata and rejects invalid files", () => {
    expect(
      uploadFileSchema.parse({
        title: "Test Book",
        fileName: "test-book.txt",
        fileSize: 1024,
        voice: "zh-CN-XiaoxiaoNeural",
        rate: "+0%",
        pitch: "+0Hz",
      }),
    ).toMatchObject({ fileName: "test-book.txt" });

    expect(() =>
      uploadFileSchema.parse({
        title: "Test Book",
        fileName: "test-book.epub",
        fileSize: 1024,
        voice: "zh-CN-XiaoxiaoNeural",
        rate: "+0%",
        pitch: "+0Hz",
      }),
    ).toThrow();

    expect(() =>
      uploadFileSchema.parse({
        title: "Test Book",
        fileName: "too-large.txt",
        fileSize: 20 * 1024 * 1024 + 1,
        voice: "zh-CN-XiaoxiaoNeural",
        rate: "+0%",
        pitch: "+0Hz",
      }),
    ).toThrow();
  });

  it("accepts a player with completed, generating, and failed parts", () => {
    expect(
      playerSchema.parse({
        bookId,
        latestJob: {
          id: jobId,
          status: "paused",
          stage: "tts",
          progress: 85,
        },
        parts: [
          {
            id: "c53a96af-2a92-4fc0-8989-9d1fa1f9f3bd",
            index: 0,
            title: "Chapter 1",
            status: "completed",
            audioUrl: "http://localhost:3000/audio/part-1.mp3",
            durationSeconds: 62,
            errorMessage: null,
          },
          {
            id: "f34a96af-2a92-4fc0-8989-9d1fa1f9f3bd",
            index: 1,
            title: "Chapter 2",
            status: "tts",
            audioUrl: null,
            durationSeconds: null,
            errorMessage: null,
          },
          {
            id: "ba4a96af-2a92-4fc0-8989-9d1fa1f9f3bd",
            index: 2,
            title: "Chapter 3",
            status: "failed",
            audioUrl: null,
            durationSeconds: null,
            errorMessage: "No audio was received.",
          },
        ],
      }),
    ).toMatchObject({ bookId });
  });
});
