import type { TtsVoice } from "@/shared/schemas/tts";

export interface VoiceCatalog {
  listVoices(): Promise<TtsVoice[]>;
}
