import { z } from "zod";

export const uploadSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    author: z.string().trim().min(1).max(120).optional(),
    text: z.string().trim().min(1).optional(),
    fileName: z.string().trim().min(1).max(255).optional(),
    voice: z.string().trim().min(1).max(100),
    rate: z.string().trim().regex(/^[+-]\d+%$/),
    pitch: z.string().trim().regex(/^[+-]\d+Hz$/),
  })
  .refine((value) => value.text !== undefined || value.fileName !== undefined, {
    message: "text or fileName is required",
    path: ["text"],
  });

export type UploadDto = z.infer<typeof uploadSchema>;
