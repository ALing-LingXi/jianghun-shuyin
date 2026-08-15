import { z } from "zod";
import { MAX_UPLOAD_FILE_SIZE_BYTES } from "./upload";

export const MAX_TEXT_CLEAN_FILE_SIZE_BYTES = MAX_UPLOAD_FILE_SIZE_BYTES;

export const textCleanUploadSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .refine((value) => /.+\.txt$/i.test(value), {
      message: "只支持 .txt 文件",
    }),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(MAX_TEXT_CLEAN_FILE_SIZE_BYTES, {
      message: "TXT 文件不能超过 20MB",
    }),
});

export type TextCleanUploadDto = z.infer<typeof textCleanUploadSchema>;
