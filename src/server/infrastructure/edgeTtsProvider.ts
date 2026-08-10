import type {
  SynthesizeSpeechInput,
  SynthesizeSpeechResult,
  TTSProvider,
} from "@/server/ports/tts";
import type { FileStorage } from "@/server/ports/storage";
import {
  DEFAULT_TTS_PITCH,
  DEFAULT_TTS_RATE,
  DEFAULT_TTS_VOICE,
} from "@/server/tts/voiceCatalog";

export type EdgeTtsAudioGenerator = (
  input: Required<Omit<SynthesizeSpeechInput, "fileName">>,
) => Promise<unknown>;

export type EdgeTtsProviderOptions = {
  storage: FileStorage;
  synthesizeSpeech?: EdgeTtsAudioGenerator;
};

export class EdgeTtsProvider implements TTSProvider {
  private readonly synthesizeSpeech: EdgeTtsAudioGenerator;

  constructor(private readonly options: EdgeTtsProviderOptions) {
    this.synthesizeSpeech = options.synthesizeSpeech ?? synthesizeWithEdgeTts;
  }

  async synthesize(
    input: SynthesizeSpeechInput,
  ): Promise<SynthesizeSpeechResult> {
    const text = input.text.trim();

    if (!text) {
      throw new Error("TTS text cannot be empty");
    }

    const voice = input.voice || DEFAULT_TTS_VOICE;
    const rate = input.rate || DEFAULT_TTS_RATE;
    const pitch = input.pitch || DEFAULT_TTS_PITCH;

    let audioBytes: Uint8Array;
    try {
      audioBytes = normalizeAudioBytes(
        await this.synthesizeSpeech({ text, voice, rate, pitch }),
      );
    } catch (error) {
      throw new Error(`TTS synthesis failed: ${toErrorMessage(error)}`);
    }

    if (audioBytes.byteLength === 0) {
      throw new Error("TTS synthesis failed: empty audio output");
    }

    const audioPath = await this.options.storage.saveChunkAudio({
      content: audioBytes,
      fileName: input.fileName ?? "tts.mp3",
    });

    return {
      audioPath,
      byteLength: audioBytes.byteLength,
      voice,
      rate,
      pitch,
    };
  }
}

async function synthesizeWithEdgeTts(
  input: Required<Omit<SynthesizeSpeechInput, "fileName">>,
): Promise<unknown> {
  let edgeTtsModule: unknown;

  try {
    const packageName = "edge-tts";
    edgeTtsModule = await import(packageName);
  } catch (error) {
    throw new Error(
      `edge-tts is not available. Install it manually with "pnpm add edge-tts" before running real TTS. ${toErrorMessage(
        error,
      )}`,
    );
  }

  const moduleRecord = asRecord(edgeTtsModule);
  const defaultRecord = asRecord(moduleRecord.default);
  const edgeTtsConstructor =
    moduleRecord.EdgeTTS ?? defaultRecord.EdgeTTS ?? moduleRecord.default;

  if (typeof edgeTtsConstructor === "function") {
    const EdgeTTS = edgeTtsConstructor as new () => unknown;
    const client = new EdgeTTS();
    const clientRecord = asRecord(client);
    const synthesize = clientRecord.synthesize;

    if (typeof synthesize === "function") {
      await synthesize.call(client, input.text, input.voice, {
        rate: input.rate,
        pitch: input.pitch,
      });

      const toBuffer = clientRecord.toBuffer;
      if (typeof toBuffer === "function") {
        return toBuffer.call(client);
      }
    }
  }

  const synthesize =
    moduleRecord.synthesize ??
    moduleRecord.synthesizeSpeech ??
    defaultRecord.synthesize ??
    defaultRecord.synthesizeSpeech;

  if (typeof synthesize === "function") {
    return synthesize(input);
  }

  throw new Error(
    "edge-tts was loaded, but no supported synthesize API was found",
  );
}

function normalizeAudioBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  const record = asRecord(value);
  for (const key of ["audio", "audioData", "buffer", "data", "content"]) {
    const nested = record[key];
    if (nested instanceof Uint8Array) {
      return nested;
    }

    if (nested instanceof ArrayBuffer) {
      return new Uint8Array(nested);
    }
  }

  throw new Error("TTS provider did not return audio bytes");
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }

  return {};
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown TTS error";
}
