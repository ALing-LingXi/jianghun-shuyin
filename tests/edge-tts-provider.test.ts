import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EdgeTtsProvider } from "../src/server/infrastructure/edgeTtsProvider";
import { LocalStorage } from "../src/server/infrastructure/localStorage";
import {
  DEFAULT_TTS_PITCH,
  DEFAULT_TTS_RATE,
  DEFAULT_TTS_VOICE,
} from "../src/server/tts/voiceCatalog";

const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

async function createStorage() {
  const storageRoot = await mkdtemp(path.join(os.tmpdir(), "jianghun-tts-"));
  tempRoots.push(storageRoot);

  return {
    storageRoot,
    storage: new LocalStorage(storageRoot),
  };
}

describe("EdgeTtsProvider", () => {
  it("saves synthesized audio bytes to chunk storage", async () => {
    const { storageRoot, storage } = await createStorage();
    const fakeAudio = new Uint8Array([0x49, 0x44, 0x33, 0x04]);
    const provider = new EdgeTtsProvider({
      storage,
      synthesizeSpeech: async (input) => {
        expect(input).toEqual({
          text: "hello jianghu.",
          voice: DEFAULT_TTS_VOICE,
          rate: DEFAULT_TTS_RATE,
          pitch: DEFAULT_TTS_PITCH,
        });

        return fakeAudio;
      },
    });

    const result = await provider.synthesize({
      text: "  hello jianghu.  ",
      voice: DEFAULT_TTS_VOICE,
      rate: DEFAULT_TTS_RATE,
      pitch: DEFAULT_TTS_PITCH,
      fileName: "preview.mp3",
    });

    expect(result).toMatchObject({
      byteLength: fakeAudio.byteLength,
      voice: DEFAULT_TTS_VOICE,
      rate: DEFAULT_TTS_RATE,
      pitch: DEFAULT_TTS_PITCH,
    });
    expect(result.audioPath).toContain(path.join(storageRoot, "chunks"));
    expect(result.audioPath).toMatch(/preview\.mp3$/);
    await expect(readFile(result.audioPath)).resolves.toEqual(
      Buffer.from(fakeAudio),
    );
  });

  it("rejects empty text before calling TTS", async () => {
    const { storage } = await createStorage();
    const provider = new EdgeTtsProvider({
      storage,
      synthesizeSpeech: async () => new Uint8Array([1]),
    });

    await expect(
      provider.synthesize({
        text: "   ",
        voice: DEFAULT_TTS_VOICE,
        rate: DEFAULT_TTS_RATE,
        pitch: DEFAULT_TTS_PITCH,
      }),
    ).rejects.toThrow("TTS text cannot be empty");
  });

  it("keeps provider failures visible", async () => {
    const { storage } = await createStorage();
    const provider = new EdgeTtsProvider({
      storage,
      synthesizeSpeech: async () => {
        throw new Error("network unavailable");
      },
    });

    await expect(
      provider.synthesize({
        text: "short text.",
        voice: DEFAULT_TTS_VOICE,
        rate: DEFAULT_TTS_RATE,
        pitch: DEFAULT_TTS_PITCH,
      }),
    ).rejects.toThrow(
      "TTS synthesis failed; provider=edge-tts-universal; error=Error; message=network unavailable",
    );
  });

  it("adds TTS request diagnostics to provider failures", async () => {
    const { storage } = await createStorage();
    const provider = new EdgeTtsProvider({
      storage,
      synthesizeSpeech: async () => {
        const error = new Error("No audio was received.");
        error.name = "NoAudioReceived";
        throw error;
      },
    });

    await expect(
      provider.synthesize({
        text: "短文本测试。",
        voice: DEFAULT_TTS_VOICE,
        rate: "+10%",
        pitch: "+5Hz",
      }),
    ).rejects.toThrow(
      'error=NoAudioReceived; message=NoAudioReceived: No audio was received.; textCharacters=6; textPreview="短文本测试。"; voice=zh-CN-YunxiNeural; rate=+10%; pitch=+5Hz',
    );
  });
});
