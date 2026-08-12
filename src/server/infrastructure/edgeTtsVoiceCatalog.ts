import type { VoiceCatalog } from "@/server/ports/voiceCatalog";
import type { TtsVoice } from "@/shared/schemas/tts";
import { DEFAULT_TTS_VOICE } from "@/server/tts/voiceCatalog";

type EdgeTtsVoice = {
  ShortName: string;
  Locale: string;
  Gender: string;
  FriendlyName: string;
};

export type EdgeTtsVoiceCatalogOptions = {
  fetchVoices?: () => Promise<EdgeTtsVoice[]>;
};

export class EdgeTtsVoiceCatalog implements VoiceCatalog {
  private voicesPromise: Promise<TtsVoice[]> | null = null;

  constructor(private readonly options: EdgeTtsVoiceCatalogOptions = {}) {}

  listVoices(): Promise<TtsVoice[]> {
    this.voicesPromise ??= this.loadVoices();
    return this.voicesPromise;
  }

  private async loadVoices(): Promise<TtsVoice[]> {
    try {
      const voices = await (this.options.fetchVoices ?? fetchEdgeTtsVoices)();
      const mapped = voices
        .map(toTtsVoice)
        .filter((voice): voice is TtsVoice => voice !== null)
        .sort(compareVoices);

      return withDefaultVoice(mapped);
    } catch {
      return [defaultVoice()];
    }
  }
}

async function fetchEdgeTtsVoices(): Promise<EdgeTtsVoice[]> {
  const edgeTtsModule = (await import("edge-tts-universal")) as {
    listVoices?: () => Promise<EdgeTtsVoice[]>;
  };

  if (typeof edgeTtsModule.listVoices !== "function") {
    throw new Error("edge-tts-universal does not export listVoices");
  }

  return edgeTtsModule.listVoices();
}

function toTtsVoice(voice: EdgeTtsVoice): TtsVoice | null {
  if (!voice.ShortName || !voice.Locale || !voice.Gender) {
    return null;
  }

  return {
    id: voice.ShortName,
    label: shortVoiceLabel(voice.ShortName),
    locale: voice.Locale,
    gender: voice.Gender,
  };
}

function withDefaultVoice(voices: TtsVoice[]): TtsVoice[] {
  if (voices.some((voice) => voice.id === DEFAULT_TTS_VOICE)) {
    return voices;
  }

  return [defaultVoice(), ...voices];
}

function defaultVoice(): TtsVoice {
  return {
    id: DEFAULT_TTS_VOICE,
    label: "云溪",
    locale: "zh-CN",
    gender: "Male",
  };
}

function shortVoiceLabel(id: string): string {
  const key = id
    .replace(/^[a-z]{2}-[A-Z]{2}(?:-[a-z]+)?-/, "")
    .replace(/(?::.*|Multilingual|Dialects|Neural)/g, "");

  return CHINESE_VOICE_LABELS[key] ?? key;
}

function compareVoices(left: TtsVoice, right: TtsVoice): number {
  if (left.id === right.id) {
    return 0;
  }

  if (left.id === DEFAULT_TTS_VOICE) {
    return -1;
  }

  if (right.id === DEFAULT_TTS_VOICE) {
    return 1;
  }

  const leftPriority = localePriority(left.locale);
  const rightPriority = localePriority(right.locale);

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  if (left.locale !== right.locale) {
    return left.locale.localeCompare(right.locale);
  }

  return left.label.localeCompare(right.label);
}

function localePriority(locale: string): number {
  if (locale === "zh-CN") {
    return 0;
  }

  if (locale.startsWith("zh-")) {
    return 1;
  }

  return 2;
}

const CHINESE_VOICE_LABELS: Record<string, string> = {
  HsiaoChen: "晓臻",
  Maroonallegro: "栗色",
  Peachgranite: "桃石",
  XiaoMin: "晓敏",
  Xiaobei: "晓北",
  Xiaochen: "晓辰",
  Xiaohan: "晓涵",
  Xiaomeng: "晓梦",
  Xiaomo: "晓墨",
  Xiaoni: "晓妮",
  Xiaoqiu: "晓秋",
  Xiaorou: "晓柔",
  Xiaorui: "晓睿",
  Xiaoshuang: "晓双",
  Xiaoxiao: "晓晓",
  Xiaoxiao2: "晓晓 2",
  Xiaoyan: "晓颜",
  Xiaoyi: "晓伊",
  Xiaoyou: "晓悠",
  Xiaoyu: "晓雨",
  Xiaoyue: "晓月",
  Xiaozhen: "晓甄",
  Yunbiao: "云彪",
  Yundeng: "云登",
  Yunfan: "云帆",
  Yunfeng: "云枫",
  Yunhan: "云翰",
  Yunhao: "云皓",
  Yunjian: "云健",
  Yunjie: "云杰",
  Yunqi: "云启",
  YunSong: "云松",
  Yunxiao: "云霄",
  Yunxiang: "云翔",
  Yunxia: "云夏",
  Yunxi: "云溪",
  Yunyi: "云逸",
  Yunye: "云野",
  Yunyang: "云扬",
  Yunze: "云泽",
  Yunzhe: "云哲",
};
