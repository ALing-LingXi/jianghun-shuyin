import { z } from "zod";
import { BOOK_STATUSES } from "@/shared/types/entities";

export const bookSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  author: z.string().trim().min(1).max(120).nullable(),
  sourcePath: z.string().trim().min(1),
  status: z.enum(BOOK_STATUSES),
  createdAt: z.iso.datetime(),
});

export const createBookSchema = bookSchema.omit({
  id: true,
  createdAt: true,
}).partial({
  author: true,
  status: true,
});

export type BookDto = z.infer<typeof bookSchema>;
export type CreateBookDto = z.infer<typeof createBookSchema>;
