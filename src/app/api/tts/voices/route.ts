import { NextResponse } from "next/server";
import { listTtsVoices } from "@/server/application/listTtsVoices";
import { createContainer } from "@/server/composition/container";
import { ttsVoiceListSchema } from "@/shared/schemas/tts";

const container = createContainer();

export async function GET() {
  try {
    const result = await listTtsVoices(container.voiceCatalog);
    return NextResponse.json(ttsVoiceListSchema.parse(result));
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "TTS_VOICES_UNAVAILABLE",
          message: "Could not load TTS voices",
        },
      },
      { status: 503 },
    );
  }
}
