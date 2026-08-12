import { z } from "zod";
import { BOOK_STATUSES, JOB_STAGES, JOB_STATUSES } from "@/shared/types/entities";

export const libraryBookSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1),
  author: z.string().trim().min(1).nullable(),
  status: z.enum(BOOK_STATUSES),
  createdAt: z.iso.datetime(),
  latestJob: z
    .object({
      id: z.string().uuid(),
      status: z.enum(JOB_STATUSES),
      stage: z.enum(JOB_STAGES),
      progress: z.number().int().min(0).max(100),
    })
    .nullable(),
  partCount: z.number().int().nonnegative(),
  playablePartCount: z.number().int().nonnegative(),
  durationSeconds: z.number().int().nonnegative(),
});

export const librarySchema = z.object({
  books: z.array(libraryBookSchema),
});

export type LibraryBookDto = z.infer<typeof libraryBookSchema>;
export type LibraryDto = z.infer<typeof librarySchema>;
