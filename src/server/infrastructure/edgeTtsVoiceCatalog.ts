import type { VoiceCatalog } from "@/server/ports/voiceCatalog";
import {
  CHINESE_TTS_VOICES,
  DEFAULT_CHINESE_TTS_VOICE,
  DEFAULT_TTS_VOICE,
  isChineseTtsVoiceId,
} from "@/server/tts/voiceCatalog";
import type { TtsVoice } from "@/shared/schemas/tts";

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
        .filter((voice) => isChineseTtsVoiceId(voice.id))
        .sort(compareVoices);

      return withDefaultVoice(mapped);
    } catch {
      return [...CHINESE_TTS_VOICES];
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
  const uniqueVoices = dedupeVoices(voices);
  if (uniqueVoices.some((voice) => voice.id === DEFAULT_TTS_VOICE)) {
    return uniqueVoices;
  }

  return [DEFAULT_CHINESE_TTS_VOICE, ...uniqueVoices];
}

function dedupeVoices(voices: TtsVoice[]): TtsVoice[] {
  const seen = new Set<string>();
  return voices.filter((voice) => {
    if (seen.has(voice.id)) {
      return false;
    }

    seen.add(voice.id);
    return true;
  });
}

function shortVoiceLabel(id: string): string {
  return id
    .replace(/^[a-z]{2}-[A-Z]{2}(?:-[a-z]+)?-/, "")
    .replace(/(?::.*|Multilingual|Dialects|Neural)/g, "");
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

  if (left.locale !== right.locale) {
    return left.locale.localeCompare(right.locale);
  }

  return left.label.localeCompare(right.label);
}
