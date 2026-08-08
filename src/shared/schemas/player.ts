import { z } from "zod";

export const playerPartSchema = z.object({
  id: z.string().uuid(),
  index: z.number().int().nonnegative(),
  title: z.string().trim().min(1),
  audioUrl: z.string().url(),
  durationSeconds: z.number().nonnegative(),
});

export const playerSchema = z.object({
  bookId: z.string().uuid(),
  parts: z.array(playerPartSchema),
});

export type PlayerPartDto = z.infer<typeof playerPartSchema>;
export type PlayerDto = z.infer<typeof playerSchema>;
