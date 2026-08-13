import { z } from "zod";
import {
  JOB_STAGES,
  JOB_STATUSES,
  PART_STATUSES,
} from "@/shared/types/entities";
import { ttsVoiceIdSchema } from "./tts";

export const jobPartSchema = z.object({
  id: z.string().uuid(),
  index: z.number().int().nonnegative(),
  title: z.string().trim().min(1),
  status: z.enum(PART_STATUSES),
  durationSeconds: z.number().int().nonnegative().nullable(),
});

export const jobSchema = z.object({
  id: z.string().uuid(),
  bookId: z.string().uuid(),
  voice: ttsVoiceIdSchema,
  rate: z.string().trim().regex(/^[+-]\d+%$/),
  pitch: z.string().trim().regex(/^[+-]\d+Hz$/),
  status: z.enum(JOB_STATUSES),
  stage: z.enum(JOB_STAGES),
  progress: z.number().int().min(0).max(100),
  errorMessage: z.string().trim().min(1).nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  parts: z.array(jobPartSchema).default([]),
});

export const createJobSchema = jobSchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    parts: true,
  })
  .partial({
    status: true,
    stage: true,
    progress: true,
    errorMessage: true,
  });

export type JobDto = z.infer<typeof jobSchema>;
export type JobPartDto = z.infer<typeof jobPartSchema>;
export type CreateJobDto = z.infer<typeof createJobSchema>;
