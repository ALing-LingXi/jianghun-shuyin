import type { VoiceCatalog } from "@/server/ports/voiceCatalog";
import type { TtsVoiceListDto } from "@/shared/schemas/tts";

export async function listTtsVoices(
  catalog: VoiceCatalog,
): Promise<TtsVoiceListDto> {
  return {
    voices: await catalog.listVoices(),
  };
}
