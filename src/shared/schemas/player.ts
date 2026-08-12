import { z } from "zod";
import { PART_STATUSES } from "@/shared/types/entities";

export const playerPartSchema = z.object({
  id: z.string().uuid(),
  index: z.number().int().nonnegative(),
  title: z.string().trim().min(1),
  status: z.enum(PART_STATUSES),
  audioUrl: z.string().min(1).nullable(),
  durationSeconds: z.number().int().nonnegative().nullable(),
  errorMessage: z.string().trim().min(1).nullable(),
});

export const playerSchema = z.object({
  bookId: z.string().uuid(),
  parts: z.array(playerPartSchema),
});

export type PlayerPartDto = z.infer<typeof playerPartSchema>;
export type PlayerDto = z.infer<typeof playerSchema>;
