import { beforeEach, describe, expect, it, vi } from "vitest";

const { deleteBook } = vi.hoisted(() => ({
  deleteBook: vi.fn(),
}));

vi.mock("../src/server/composition/container", () => ({
  createContainer: () => ({
    deleteBook,
  }),
}));

import { DELETE } from "../src/app/api/books/[bookId]/route";

const bookId = "11111111-1111-4111-8111-111111111111";

describe("DELETE /api/books/[bookId]", () => {
  beforeEach(() => {
    deleteBook.mockReset();
  });

  it("deletes a book", async () => {
    deleteBook.mockResolvedValueOnce({ deleted: true });

    const response = await DELETE(new Request(`http://localhost/api/books/${bookId}`), {
      params: Promise.resolve({ bookId }),
    });

    expect(response.status).toBe(204);
    expect(deleteBook).toHaveBeenCalledWith(bookId);
  });

  it("returns 404 when the book is missing", async () => {
    deleteBook.mockResolvedValueOnce({ deleted: false });

    const response = await DELETE(new Request(`http://localhost/api/books/${bookId}`), {
      params: Promise.resolve({ bookId }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "BOOK_NOT_FOUND" },
    });
  });

  it("returns 400 for invalid book ids", async () => {
    const response = await DELETE(new Request("http://localhost/api/books/not-a-uuid"), {
      params: Promise.resolve({ bookId: "not-a-uuid" }),
    });

    expect(response.status).toBe(400);
    expect(deleteBook).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
  });
});
