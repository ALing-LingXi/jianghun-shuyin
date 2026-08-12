import type { TtsVoice } from "@/shared/schemas/tts";
import {
  DEFAULT_TTS_PITCH,
  DEFAULT_TTS_RATE,
  DEFAULT_TTS_VOICE,
} from "@/shared/tts";

export { DEFAULT_TTS_PITCH, DEFAULT_TTS_RATE, DEFAULT_TTS_VOICE };

export const DEFAULT_CHINESE_TTS_VOICE = {
  id: DEFAULT_TTS_VOICE,
  label: "Yunxi",
  locale: "zh-CN",
  gender: "Male",
} as const satisfies TtsVoice;

export const CHINESE_TTS_VOICES = [
  DEFAULT_CHINESE_TTS_VOICE,
  {
    id: "zh-CN-XiaoxiaoNeural",
    label: "Xiaoxiao",
    locale: "zh-CN",
    gender: "Female",
  },
  {
    id: "zh-CN-XiaoyiNeural",
    label: "Xiaoyi",
    locale: "zh-CN",
    gender: "Female",
  },
  {
    id: "zh-CN-YunjianNeural",
    label: "Yunjian",
    locale: "zh-CN",
    gender: "Male",
  },
  {
    id: "zh-CN-YunyangNeural",
    label: "Yunyang",
    locale: "zh-CN",
    gender: "Male",
  },
  {
    id: "zh-CN-YunfengNeural",
    label: "Yunfeng",
    locale: "zh-CN",
    gender: "Male",
  },
  {
    id: "zh-CN-XiaohanNeural",
    label: "Xiaohan",
    locale: "zh-CN",
    gender: "Female",
  },
  {
    id: "zh-CN-XiaomoNeural",
    label: "Xiaomo",
    locale: "zh-CN",
    gender: "Female",
  },
  {
    id: "zh-CN-XiaoxuanNeural",
    label: "Xiaoxuan",
    locale: "zh-CN",
    gender: "Female",
  },
  {
    id: "zh-CN-XiaoruiNeural",
    label: "Xiaorui",
    locale: "zh-CN",
    gender: "Female",
  },
  {
    id: "zh-CN-YunxiaNeural",
    label: "Yunxia",
    locale: "zh-CN",
    gender: "Male",
  },
] as const satisfies readonly TtsVoice[];

export function isChineseTtsVoiceId(voice: string): boolean {
  return voice.startsWith("zh-");
}

export function isListedChineseTtsVoiceId(voice: string): boolean {
  return CHINESE_TTS_VOICES.some((option) => option.id === voice);
}
