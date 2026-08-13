import { z } from "zod";
import {
  JOB_STAGES,
  JOB_STATUSES,
  PART_STATUSES,
} from "@/shared/types/entities";

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
  latestJob: z
    .object({
      id: z.string().uuid(),
      status: z.enum(JOB_STATUSES),
      stage: z.enum(JOB_STAGES),
      progress: z.number().int().min(0).max(100),
    })
    .nullable()
    .default(null),
  parts: z.array(playerPartSchema),
});

export type PlayerPartDto = z.infer<typeof playerPartSchema>;
export type PlayerDto = z.infer<typeof playerSchema>;
