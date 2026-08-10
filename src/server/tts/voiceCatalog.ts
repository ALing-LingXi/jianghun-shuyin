export const DEFAULT_TTS_VOICE = "zh-CN-XiaoxiaoNeural";
export const DEFAULT_TTS_RATE = "+0%";
export const DEFAULT_TTS_PITCH = "+0Hz";

export const CHINESE_TTS_VOICES = [
  {
    id: DEFAULT_TTS_VOICE,
    label: "Xiaoxiao",
    locale: "zh-CN",
  },
  {
    id: "zh-CN-YunxiNeural",
    label: "Yunxi",
    locale: "zh-CN",
  },
] as const;
