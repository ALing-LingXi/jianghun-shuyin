import { z } from "zod";
import { ttsVoiceIdSchema } from "./tts";
import {
  DEFAULT_TTS_PITCH,
  DEFAULT_TTS_RATE,
  DEFAULT_TTS_VOICE,
} from "@/shared/tts";

const textSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, {
    message: "text is required",
  });

const uploadFieldsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  author: z.string().trim().min(1).max(120).optional(),
  text: textSchema.optional(),
  fileName: z.string().trim().min(1).max(255).optional(),
  voice: ttsVoiceIdSchema.default(DEFAULT_TTS_VOICE),
  rate: z.string().trim().regex(/^[+-]\d+%$/).default(DEFAULT_TTS_RATE),
  pitch: z.string().trim().regex(/^[+-]\d+Hz$/).default(DEFAULT_TTS_PITCH),
});

export const uploadSchema = uploadFieldsSchema
  .refine((value) => value.text !== undefined || value.fileName !== undefined, {
    message: "text or fileName is required",
    path: ["text"],
  });

export const uploadTextSchema = uploadFieldsSchema
  .omit({ fileName: true })
  .required({ text: true });

export const uploadTextResponseSchema = z.object({
  bookId: z.string().uuid(),
  jobId: z.string().uuid(),
});

export type UploadTextDto = z.infer<typeof uploadTextSchema>;
export type UploadTextResponseDto = z.infer<typeof uploadTextResponseSchema>;
export type UploadDto = z.infer<typeof uploadSchema>;
