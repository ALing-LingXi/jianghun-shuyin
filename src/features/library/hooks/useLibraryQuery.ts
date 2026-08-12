"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { librarySchema, type LibraryDto } from "@/shared/schemas/library";

export class LibraryApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "LibraryApiError";
  }
}

export async function fetchLibrary(): Promise<LibraryDto> {
  const response = await fetch("/api/books");
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new LibraryApiError(
      body?.error?.message ?? "Library request failed",
      response.status,
    );
  }

  return librarySchema.parse(body);
}

export async function deleteLibraryBook(bookId: string): Promise<void> {
  const response = await fetch(`/api/books/${bookId}`, {
    method: "DELETE",
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new LibraryApiError(
      body?.error?.message ?? "Book delete request failed",
      response.status,
    );
  }
}

export function useLibraryQuery() {
  return useQuery<LibraryDto, LibraryApiError>({
    queryKey: ["library"],
    queryFn: fetchLibrary,
    retry: false,
  });
}

export function useDeleteLibraryBook() {
  const queryClient = useQueryClient();

  return useMutation<void, LibraryApiError, string>({
    mutationFn: deleteLibraryBook,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["library"] });
    },
  });
}
