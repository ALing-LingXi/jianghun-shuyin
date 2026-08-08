import { z } from "zod";
import { JOB_STAGES, JOB_STATUSES } from "@/shared/types/entities";

export const jobSchema = z.object({
  id: z.string().uuid(),
  bookId: z.string().uuid(),
  status: z.enum(JOB_STATUSES),
  stage: z.enum(JOB_STAGES),
  progress: z.number().int().min(0).max(100),
  errorMessage: z.string().trim().min(1).nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const createJobSchema = jobSchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .partial({
    status: true,
    stage: true,
    progress: true,
    errorMessage: true,
  });

export type JobDto = z.infer<typeof jobSchema>;
export type CreateJobDto = z.infer<typeof createJobSchema>;
