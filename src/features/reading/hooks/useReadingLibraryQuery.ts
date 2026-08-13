"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  readingBookDetailSchema,
  readingChapterDetailSchema,
  readingLibrarySchema,
  readingUploadResponseSchema,
  type ReadingBookDetailDto,
  type ReadingChapterDetailDto,
  type ReadingLibraryDto,
  type ReadingUploadResponseDto,
} from "@/shared/schemas/reading";

export class ReadingApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export function useReadingLibraryQuery() {
  return useQuery<ReadingLibraryDto, ReadingApiError>({
    queryKey: ["reading-library"],
    queryFn: async () => {
      const response = await fetch("/api/reading/books");
      const body = await parseJson(response);

      if (!response.ok) {
        throw toApiError(response, body, "阅读书架加载失败");
      }

      return readingLibrarySchema.parse(body);
    },
  });
}

export function useReadingBookQuery(bookId: string) {
  return useQuery<ReadingBookDetailDto, ReadingApiError>({
    queryKey: ["reading-book", bookId],
    queryFn: async () => {
      const response = await fetch(`/api/reading/books/${bookId}`);
      const body = await parseJson(response);

      if (!response.ok) {
        throw toApiError(response, body, "书籍加载失败");
      }

      return readingBookDetailSchema.parse(body);
    },
    enabled: bookId.length > 0,
  });
}

export function useReadingChapterQuery(bookId: string, chapterIndex: number) {
  return useQuery<ReadingChapterDetailDto, ReadingApiError>({
    queryKey: ["reading-chapter", bookId, chapterIndex],
    queryFn: async () => {
      const response = await fetch(
        `/api/reading/books/${bookId}/chapters/${chapterIndex}`,
      );
      const body = await parseJson(response);

      if (!response.ok) {
        throw toApiError(response, body, "章节加载失败");
      }

      return readingChapterDetailSchema.parse(body);
    },
    enabled: bookId.length > 0,
  });
}

export function useCreateReadingBook() {
  const queryClient = useQueryClient();

  return useMutation<ReadingUploadResponseDto, ReadingApiError, FormData>({
    mutationFn: async (formData) => {
      const response = await fetch("/api/reading/uploads", {
        method: "POST",
        body: formData,
      });
      const body = await parseJson(response);

      if (!response.ok) {
        throw toApiError(response, body, "上传阅读书籍失败");
      }

      return readingUploadResponseSchema.parse(body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reading-library"] });
    },
  });
}

export function useDeleteReadingBook() {
  const queryClient = useQueryClient();

  return useMutation<void, ReadingApiError, string>({
    mutationFn: async (bookId) => {
      const response = await fetch(`/api/reading/books/${bookId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = await parseJson(response);
        throw toApiError(response, body, "删除阅读书籍失败");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reading-library"] });
    },
  });
}

export function useUpdateReadingProgress() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    ReadingApiError,
    { bookId: string; chapterIndex: number }
  >({
    mutationFn: async ({ bookId, chapterIndex }) => {
      const response = await fetch(`/api/reading/books/${bookId}/progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterIndex }),
      });

      if (!response.ok) {
        const body = await parseJson(response);
        throw toApiError(response, body, "阅读进度保存失败");
      }
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["reading-library"] });
      void queryClient.invalidateQueries({
        queryKey: ["reading-book", variables.bookId],
      });
    },
  });
}

async function parseJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function toApiError(
  response: Response,
  body: unknown,
  fallback: string,
): ReadingApiError {
  const message =
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "object" &&
    body.error !== null &&
    "message" in body.error &&
    typeof body.error.message === "string"
      ? body.error.message
      : fallback;

  return new ReadingApiError(message, response.status);
}
