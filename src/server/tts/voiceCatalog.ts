import type { TtsVoice } from "@/shared/schemas/tts";
import {
  DEFAULT_TTS_PITCH,
  DEFAULT_TTS_RATE,
  DEFAULT_TTS_VOICE,
} from "@/shared/tts";

export { DEFAULT_TTS_PITCH, DEFAULT_TTS_RATE, DEFAULT_TTS_VOICE };

export const DEFAULT_CHINESE_TTS_VOICE = {
  id: DEFAULT_TTS_VOICE,
  label: "云溪",
  locale: "zh-CN",
  gender: "Male",
} as const satisfies TtsVoice;

export const CHINESE_TTS_VOICES = [
  DEFAULT_CHINESE_TTS_VOICE,
  {
    id: "zh-CN-XiaoxiaoNeural",
    label: "晓晓",
    locale: "zh-CN",
    gender: "Female",
  },
  {
    id: "zh-CN-XiaoyiNeural",
    label: "晓伊",
    locale: "zh-CN",
    gender: "Female",
  },
  {
    id: "zh-CN-YunjianNeural",
    label: "云健",
    locale: "zh-CN",
    gender: "Male",
  },
  {
    id: "zh-CN-YunyangNeural",
    label: "云扬",
    locale: "zh-CN",
    gender: "Male",
  },
  {
    id: "zh-CN-YunfengNeural",
    label: "云枫",
    locale: "zh-CN",
    gender: "Male",
  },
  {
    id: "zh-CN-XiaohanNeural",
    label: "晓涵",
    locale: "zh-CN",
    gender: "Female",
  },
  {
    id: "zh-CN-XiaomoNeural",
    label: "晓墨",
    locale: "zh-CN",
    gender: "Female",
  },
  {
    id: "zh-CN-XiaoxuanNeural",
    label: "晓萱",
    locale: "zh-CN",
    gender: "Female",
  },
  {
    id: "zh-CN-XiaoruiNeural",
    label: "晓睿",
    locale: "zh-CN",
    gender: "Female",
  },
  {
    id: "zh-CN-YunxiaNeural",
    label: "云夏",
    locale: "zh-CN",
    gender: "Male",
  },
] as const satisfies readonly TtsVoice[];

const SHORT_VOICE_LABELS: Record<string, string> = {
  "zh-CN-XiaochenNeural": "晓辰",
  "zh-CN-XiaomengNeural": "晓梦",
  "zh-CN-XiaoqiuNeural": "晓秋",
  "zh-CN-XiaoshuangNeural": "晓双",
  "zh-CN-XiaoyanNeural": "晓颜",
  "zh-CN-XiaoyouNeural": "晓悠",
  "zh-CN-XiaozhenNeural": "晓甄",
  "zh-CN-YunzeNeural": "云泽",
  "zh-HK-HiuGaaiNeural": "晓佳",
  "zh-HK-HiuMaanNeural": "晓曼",
  "zh-HK-WanLungNeural": "云龙",
  "zh-TW-HsiaoChenNeural": "晓臻",
  "zh-TW-HsiaoYuNeural": "晓雨",
  "zh-TW-YunJheNeural": "云哲",
};

for (const voice of CHINESE_TTS_VOICES) {
  SHORT_VOICE_LABELS[voice.id] = voice.label;
}

export function isChineseTtsVoiceId(voice: string): boolean {
  return voice.startsWith("zh-");
}

export function isListedChineseTtsVoiceId(voice: string): boolean {
  return CHINESE_TTS_VOICES.some((option) => option.id === voice);
}

export function labelForTtsVoiceId(id: string): string {
  return SHORT_VOICE_LABELS[id] ?? shortVoiceLabel(id);
}

function shortVoiceLabel(id: string): string {
  return id
    .replace(/^[a-z]{2}-[A-Z]{2}(?:-[a-z]+)?-/, "")
    .replace(/(?::.*|Multilingual|Dialects|Neural)/g, "");
}
