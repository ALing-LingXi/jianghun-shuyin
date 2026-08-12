import { z } from "zod";

export const ttsVoiceIdSchema = z.string().trim().min(1).max(100);
export const chineseTtsVoiceIdSchema = ttsVoiceIdSchema.refine(
  (value) => value.startsWith("zh-"),
  {
    message: "voice must be a Chinese Edge TTS voice",
  },
);

export const ttsVoiceSchema = z.object({
  id: ttsVoiceIdSchema,
  label: z.string().trim().min(1).max(200),
  locale: z.string().trim().min(1).max(20),
  gender: z.string().trim().min(1).max(20),
});

export const ttsVoiceListSchema = z.object({
  voices: z.array(ttsVoiceSchema),
});

export type TtsVoice = z.infer<typeof ttsVoiceSchema>;
export type TtsVoiceListDto = z.infer<typeof ttsVoiceListSchema>;
