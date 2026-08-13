import { z } from "zod";
import { READING_BOOK_STATUSES } from "@/shared/types/entities";

export const MAX_READING_TEXT_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_READING_COVER_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export const readingUploadSchema = z.object({
  title: z.string().trim().min(1, "书名不能为空").max(200),
  author: z.string().trim().min(1).max(120).optional(),
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .refine((value) => /.+\.txt$/i.test(value), {
      message: "只支持 .txt 文件",
    }),
  fileSize: z
    .number()
    .int()
    .positive("TXT 文件不能为空")
    .max(MAX_READING_TEXT_FILE_SIZE_BYTES, {
      message: "TXT 文件不能超过 20MB",
    }),
  coverFileName: z.string().trim().min(1).max(255),
  coverFileSize: z
    .number()
    .int()
    .positive("封面文件不能为空")
    .max(MAX_READING_COVER_FILE_SIZE_BYTES, {
      message: "封面文件不能超过 5MB",
    }),
  coverMimeType: z
    .string()
    .trim()
    .refine((value) => /^image\/(jpeg|png|webp|gif)$/i.test(value), {
      message: "封面只支持 JPG、PNG、WEBP 或 GIF",
    }),
});

export const readingBookSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  author: z.string().nullable(),
  coverUrl: z.string(),
  status: z.enum(READING_BOOK_STATUSES),
  chapterCount: z.number().int().nonnegative(),
  currentChapterIndex: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
});

export const readingLibrarySchema = z.object({
  books: z.array(readingBookSummarySchema),
});

export const readingChapterSchema = z.object({
  id: z.string().uuid(),
  index: z.number().int().nonnegative(),
  title: z.string(),
});

export const readingBookDetailSchema = readingBookSummarySchema.extend({
  chapters: z.array(readingChapterSchema),
});

export const readingChapterDetailSchema = z.object({
  book: readingBookSummarySchema,
  chapter: readingChapterSchema.extend({
    content: z.string(),
  }),
  previousChapterIndex: z.number().int().nonnegative().nullable(),
  nextChapterIndex: z.number().int().nonnegative().nullable(),
});

export const readingUploadResponseSchema = z.object({
  bookId: z.string().uuid(),
});

export const readingProgressSchema = z.object({
  chapterIndex: z.number().int().nonnegative(),
});

export type ReadingUploadDto = z.infer<typeof readingUploadSchema>;
export type ReadingUploadResponseDto = z.infer<typeof readingUploadResponseSchema>;
export type ReadingBookSummaryDto = z.infer<typeof readingBookSummarySchema>;
export type ReadingLibraryDto = z.infer<typeof readingLibrarySchema>;
export type ReadingBookDetailDto = z.infer<typeof readingBookDetailSchema>;
export type ReadingChapterDetailDto = z.infer<typeof readingChapterDetailSchema>;
export type ReadingProgressDto = z.infer<typeof readingProgressSchema>;
