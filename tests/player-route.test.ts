import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Part } from "../src/server/domain/entities";
import type { PlayerDto } from "../src/shared/schemas/player";

const { queryPlayer, findPartById } = vi.hoisted(() => ({
  queryPlayer: vi.fn(),
  findPartById: vi.fn(),
}));

vi.mock("../src/server/composition/container", () => ({
  createContainer: () => ({
    queryPlayer,
    parts: {
      findById: findPartById,
    },
  }),
}));

import { GET } from "../src/app/api/player/books/[bookId]/route";

const bookId = "11111111-1111-4111-8111-111111111111";
const partId = "22222222-2222-4222-8222-222222222222";
const tempRoots: string[] = [];

beforeEach(() => {
  queryPlayer.mockReset();
  findPartById.mockReset();
});

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

function createPlayer(overrides: Partial<PlayerDto> = {}): PlayerDto {
  return {
    bookId,
    parts: [
      {
        id: partId,
        index: 0,
        title: "Chapter 1",
        status: "completed",
        audioUrl: `/api/player/books/${bookId}?partId=${partId}`,
        durationSeconds: 12,
        errorMessage: null,
      },
    ],
    ...overrides,
  };
}

function createPart(overrides: Partial<Part> = {}): Part {
  return {
    id: partId,
    bookId,
    index: 0,
    title: "Chapter 1",
    audioPath: "storage/parts/part.mp3",
    durationSeconds: 12,
    status: "completed",
    ...overrides,
  };
}

describe("GET /api/player/books/[bookId]", () => {
  it("returns a player dto", async () => {
    queryPlayer.mockResolvedValueOnce(createPlayer());

    const response = await GET(
      new Request(`http://localhost/api/player/books/${bookId}`),
      {
        params: Promise.resolve({ bookId }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      bookId,
      parts: [
        {
          id: partId,
          status: "completed",
          audioUrl: `/api/player/books/${bookId}?partId=${partId}`,
        },
      ],
    });
  });

  it("returns audio bytes for a completed part", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "jianghun-player-"));
    tempRoots.push(root);
    const audioPath = path.join(root, "part.mp3");
    await writeFile(audioPath, new Uint8Array([1, 2, 3]));
    findPartById.mockResolvedValueOnce(createPart({ audioPath }));

    const response = await GET(
      new Request(`http://localhost/api/player/books/${bookId}?partId=${partId}`),
      {
        params: Promise.resolve({ bookId }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    await expect(response.arrayBuffer()).resolves.toHaveProperty("byteLength", 3);
  });

  it("does not return audio for failed parts", async () => {
    findPartById.mockResolvedValueOnce(
      createPart({ status: "failed", audioPath: "storage/parts/stale.mp3" }),
    );

    const response = await GET(
      new Request(`http://localhost/api/player/books/${bookId}?partId=${partId}`),
      {
        params: Promise.resolve({ bookId }),
      },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "PART_NOT_FOUND" },
    });
  });

  it("returns 404 when a player is missing", async () => {
    queryPlayer.mockResolvedValueOnce(null);

    const response = await GET(
      new Request(`http://localhost/api/player/books/${bookId}`),
      {
        params: Promise.resolve({ bookId }),
      },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "PLAYER_NOT_FOUND" },
    });
  });

  it("returns 400 for invalid book ids", async () => {
    const response = await GET(
      new Request("http://localhost/api/player/books/not-a-uuid"),
      {
        params: Promise.resolve({ bookId: "not-a-uuid" }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
  });
});
