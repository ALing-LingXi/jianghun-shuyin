import { z } from "zod";
import { chineseTtsVoiceIdSchema } from "./tts";
import {
  DEFAULT_TTS_PITCH,
  DEFAULT_TTS_RATE,
  DEFAULT_TTS_VOICE,
} from "@/shared/tts";

export const MAX_UPLOAD_FILE_SIZE_BYTES = 20 * 1024 * 1024;

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
  voice: chineseTtsVoiceIdSchema.default(DEFAULT_TTS_VOICE),
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

export const uploadFileSchema = uploadFieldsSchema
  .omit({ text: true })
  .extend({
    fileName: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .refine((value) => /.+\.txt$/i.test(value), {
        message: "仅支持 .txt 文件",
      }),
    fileSize: z
      .number()
      .int()
      .positive()
      .max(MAX_UPLOAD_FILE_SIZE_BYTES, {
        message: "文件不能超过 20MB",
      }),
  });

export const uploadTextResponseSchema = z.object({
  bookId: z.string().uuid(),
  jobId: z.string().uuid(),
});

export type UploadTextDto = z.infer<typeof uploadTextSchema>;
export type UploadTextResponseDto = z.infer<typeof uploadTextResponseSchema>;
export type UploadFileDto = z.infer<typeof uploadFileSchema>;
export type UploadDto = z.infer<typeof uploadSchema>;
