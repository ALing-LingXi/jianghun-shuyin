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

export type EdgeTtsProviderOptions = {
  storage: FileStorage;
  synthesizeSpeech?: EdgeTtsAudioGenerator;
};

export type EdgeTtsAudioGenerator = (
  input: Required<Omit<SynthesizeSpeechInput, "fileName" | "timeoutMs">>,
) => Promise<unknown>;

type UniversalEdgeTTSResult = {
  audio: Blob;
};

type UniversalEdgeTTSConstructor = new (
  text: string,
  voice?: string,
  options?: {
    rate?: string;
    pitch?: string;
  },
) => {
  synthesize(): Promise<UniversalEdgeTTSResult>;
};

export class EdgeTtsProvider implements TTSProvider {
  constructor(private readonly options: EdgeTtsProviderOptions) {}

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
      const synthesizeSpeech =
        this.options.synthesizeSpeech ?? synthesizeAudioBytes;
      audioBytes = await normalizeAudioBytes(
        await withTimeout(
          synthesizeSpeech({ text, voice, rate, pitch }),
          input.timeoutMs,
          "TTS attempt timed out",
        ),
      );
    } catch (error) {
      const diagnostic = {
        provider: "edge-tts-universal",
        errorName: errorName(error),
        message: toMessage(error),
        textCharacters: text.length,
        textPreview: previewText(text),
        voice,
        rate,
        pitch,
      };
      console.error("[tts] provider synthesis failed", diagnostic);
      throw new Error(formatProviderDiagnostic(diagnostic));
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

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number | undefined,
  message: string,
): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) {
    return promise;
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  let timedOut = false;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      reject(new TtsAttemptTimeoutError(message));
    }, timeoutMs);
  });
  promise.catch((error) => {
    if (timedOut) {
      console.warn("[tts] late synthesis failure after timeout", {
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : "Unknown TTS error",
      });
    }
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

class TtsAttemptTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TtsAttemptTimeoutError";
  }
}

async function synthesizeAudioBytes(input: {
  text: string;
  voice: string;
  rate: string;
  pitch: string;
}): Promise<unknown> {
  const { UniversalEdgeTTS } = await loadUniversalEdgeTts();
  const tts = new UniversalEdgeTTS(input.text, input.voice, {
    rate: input.rate,
    pitch: input.pitch,
  });
  return tts.synthesize();
}

async function loadUniversalEdgeTts(): Promise<{
  UniversalEdgeTTS: UniversalEdgeTTSConstructor;
}> {
  try {
    const edgeTtsModule = (await import("edge-tts-universal")) as Record<
      string,
      unknown
    >;
    const ctor = edgeTtsModule.UniversalEdgeTTS ?? edgeTtsModule.EdgeTTS;

    if (typeof ctor !== "function") {
      throw new Error("UniversalEdgeTTS export not found");
    }

    return {
      UniversalEdgeTTS: ctor as UniversalEdgeTTSConstructor,
    };
  } catch (error) {
    throw new Error(
      `edge-tts-universal is not available or failed to load: ${toMessage(
        error,
      )}`,
    );
  }
}

function toMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.name === "Error"
      ? error.message
      : `${error.name}: ${error.message}`;
  }

  return "Unknown TTS error";
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

function previewText(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 120
    ? `${normalized.slice(0, 120)}...`
    : normalized;
}

function formatProviderDiagnostic(diagnostic: {
  provider: string;
  errorName: string;
  message: string;
  textCharacters: number;
  textPreview: string;
  voice: string;
  rate: string;
  pitch: string;
}): string {
  return [
    "TTS synthesis failed",
    `provider=${diagnostic.provider}`,
    `error=${diagnostic.errorName}`,
    `message=${diagnostic.message}`,
    `textCharacters=${diagnostic.textCharacters}`,
    `textPreview=${JSON.stringify(diagnostic.textPreview)}`,
    `voice=${diagnostic.voice}`,
    `rate=${diagnostic.rate}`,
    `pitch=${diagnostic.pitch}`,
  ].join("; ");
}

async function normalizeAudioBytes(value: unknown): Promise<Uint8Array> {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  const audio = asRecord(value).audio ?? value;
  if (audio instanceof Blob) {
    return new Uint8Array(await audio.arrayBuffer());
  }

  const audioRecord = asRecord(audio);
  if (typeof audioRecord.arrayBuffer === "function") {
    const arrayBuffer = await audioRecord.arrayBuffer.call(audio);
    if (arrayBuffer instanceof ArrayBuffer) {
      return new Uint8Array(arrayBuffer);
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
