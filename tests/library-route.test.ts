import { describe, expect, it, vi } from "vitest";
import type { LibraryDto } from "../src/shared/schemas/library";

const { queryLibrary } = vi.hoisted(() => ({
  queryLibrary: vi.fn(),
}));

vi.mock("../src/server/composition/container", () => ({
  createContainer: () => ({
    queryLibrary,
  }),
}));

import { GET } from "../src/app/api/books/route";

describe("GET /api/books", () => {
  it("returns a library dto", async () => {
    const payload: LibraryDto = {
      books: [],
    };
    queryLibrary.mockResolvedValueOnce(payload);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(payload);
  });
});
