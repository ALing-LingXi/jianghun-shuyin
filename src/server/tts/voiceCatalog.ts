import {
  DEFAULT_TTS_PITCH,
  DEFAULT_TTS_RATE,
  DEFAULT_TTS_VOICE,
} from "@/shared/tts";

export { DEFAULT_TTS_PITCH, DEFAULT_TTS_RATE, DEFAULT_TTS_VOICE };

export const CHINESE_TTS_VOICES = [
  {
    id: DEFAULT_TTS_VOICE,
    label: "云溪配音",
    locale: "zh-CN",
  },
  {
    id: "zh-CN-XiaoxiaoNeural",
    label: "Xiaoxiao",
    locale: "zh-CN",
  },
] as const;
