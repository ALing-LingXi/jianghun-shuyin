import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CommandRunner } from "../src/server/infrastructure/ffmpegAudio";
import { FfmpegAudio } from "../src/server/infrastructure/ffmpegAudio";

const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

async function createTempRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "jianghun-ffmpeg-"));
  tempRoots.push(root);
  return root;
}

async function createProjectBinaryDir(root: string) {
  const binaryDir = path.join(root, "tools", "ffmpeg", "bin");
  await mkdir(binaryDir, { recursive: true });
  await writeFile(path.join(binaryDir, "ffmpeg.exe"), new Uint8Array([1]));
  await writeFile(path.join(binaryDir, "ffprobe.exe"), new Uint8Array([2]));
  return binaryDir;
}

describe("FfmpegAudio", () => {
  it("checks packaged ffmpeg and ffprobe availability", async () => {
    const root = await createTempRoot();
    const binaryDir = await createProjectBinaryDir(root);
    const runCommand = vi.fn<CommandRunner>(async () => ({
      stdout: "ok",
      stderr: "",
    }));
    const audio = new FfmpegAudio({
      outputDir: path.join(root, "parts"),
      binaryDir,
      runCommand,
    });

    await expect(audio.checkAvailable()).resolves.toBeUndefined();
    const commands = runCommand.mock.calls.map(([command]) =>
      command.replace(/\\/g, "/"),
    );
    expect(commands[0]).toContain("/tools/ffmpeg/bin/");
    expect(path.basename(commands[0])).toBe("ffmpeg.exe");
    expect(commands[1]).toContain("/tools/ffmpeg/bin/");
    expect(path.basename(commands[1])).toBe("ffprobe.exe");
  });

  it("returns a clear error when ffmpeg is unavailable", async () => {
    const root = await createTempRoot();
    const audio = new FfmpegAudio({
      outputDir: path.join(root, "parts"),
      binaryDir: await createProjectBinaryDir(root),
      runCommand: async () => {
        throw new Error("spawn ENOENT");
      },
    });

    await expect(audio.checkAvailable()).rejects.toThrow(
      "Project FFmpeg is not available",
    );
  });

  it("concatenates chunk files and reads the output duration", async () => {
    const root = await createTempRoot();
    const binaryDir = await createProjectBinaryDir(root);
    const chunkA = path.join(root, "a.mp3");
    const chunkB = path.join(root, "b.mp3");
    await writeFile(chunkA, new Uint8Array([1, 2, 3]));
    await writeFile(chunkB, new Uint8Array([4, 5, 6]));
    const runCommand = vi.fn<CommandRunner>(async (command, args) => {
      const executable = path.basename(command).toLowerCase();
      if (executable.startsWith("ffprobe") && args.includes("-show_entries")) {
        return { stdout: "12.4\n", stderr: "" };
      }

      if (executable.startsWith("ffmpeg") && args.includes("-f")) {
        await writeFile(args.at(-1)!, new Uint8Array([9]));
      }

      return { stdout: "ok", stderr: "" };
    });
    const audio = new FfmpegAudio({
      outputDir: path.join(root, "parts"),
      binaryDir,
      runCommand,
    });

    const result = await audio.assemblePart({
      partId: "part-1",
      chunkAudioPaths: [chunkA, chunkB],
      fileName: "part-1.mp3",
    });

    expect(result.audioPath).toMatch(/part-1\.mp3$/);
    expect(result.durationSeconds).toBe(12);
    expect(
      runCommand.mock.calls.some(
        ([command, args]) =>
          path.basename(command).toLowerCase().startsWith("ffmpeg") &&
          args.includes("concat") &&
          args.includes("-safe") &&
          args.includes("0"),
      ),
    ).toBe(true);
    expect(
      runCommand.mock.calls.some(
        ([command, args]) =>
          path.basename(command).toLowerCase().startsWith("ffprobe") &&
          args.includes(result.audioPath),
      ),
    ).toBe(true);
  });

  it("does not silently assemble missing chunks", async () => {
    const root = await createTempRoot();
    const audio = new FfmpegAudio({
      outputDir: path.join(root, "parts"),
      binaryDir: await createProjectBinaryDir(root),
      runCommand: async () => ({ stdout: "ok", stderr: "" }),
    });

    await expect(
      audio.assemblePart({
        partId: "part-1",
        chunkAudioPaths: [path.join(root, "missing.mp3")],
      }),
    ).rejects.toThrow("Chunk audio file is missing");
  });
});
