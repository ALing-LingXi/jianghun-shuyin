import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AssemblePartAudioInput,
  AssemblePartAudioResult,
  AudioAssembler,
} from "@/server/ports/audio";

export type CommandResult = {
  stdout: string;
  stderr: string;
};

export type CommandRunner = (
  command: string,
  args: string[],
) => Promise<CommandResult>;

export type FfmpegAudioOptions = {
  outputDir: string;
  binaryDir?: string;
  runCommand?: CommandRunner;
};

export class FfmpegAudio implements AudioAssembler {
  private readonly runCommand: CommandRunner;
  private resolvedPaths: Promise<ResolvedBinaryPaths> | null = null;

  constructor(private readonly options: FfmpegAudioOptions) {
    this.runCommand = options.runCommand ?? runCommandWithSpawn;
  }

  async checkAvailable(): Promise<void> {
    try {
      const paths = await this.getBinaryPaths();
      await this.runCommand(paths.ffmpegPath, ["-version"]);
      await this.runCommand(paths.ffprobePath, ["-version"]);
    } catch (error) {
      throw new Error(
        `Project FFmpeg is not available. Put ffmpeg.exe and ffprobe.exe in tools/ffmpeg/bin. ${toErrorMessage(error)}`,
      );
    }
  }

  async assemblePart(
    input: AssemblePartAudioInput,
  ): Promise<AssemblePartAudioResult> {
    if (input.chunkAudioPaths.length === 0) {
      throw new Error("Cannot assemble part audio without chunk files");
    }

    const paths = await this.getBinaryPaths();
    await this.checkAvailable();
    await mkdir(this.options.outputDir, { recursive: true });

    for (const chunkAudioPath of input.chunkAudioPaths) {
      try {
        await access(chunkAudioPath);
      } catch {
        throw new Error(`Chunk audio file is missing: ${chunkAudioPath}`);
      }
    }

    const outputPath = path.join(
      this.options.outputDir,
      `${randomUUID()}-${sanitizeFileName(input.fileName ?? `${input.partId}.mp3`)}`,
    );
    const listPath = path.join(
      this.options.outputDir,
      `${randomUUID()}-${sanitizeFileName(input.partId)}.concat.txt`,
    );

    await writeFile(listPath, createConcatList(input.chunkAudioPaths), "utf8");

    try {
      await this.runCommand(paths.ffmpegPath, [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listPath,
        "-c",
        "copy",
        outputPath,
      ]);

      return {
        audioPath: outputPath,
        durationSeconds: await this.readDurationSeconds(outputPath),
      };
    } catch (error) {
      throw new Error(`FFmpeg part assembly failed: ${toErrorMessage(error)}`);
    } finally {
      await unlink(listPath).catch(() => undefined);
    }
  }

  async readDurationSeconds(audioPath: string): Promise<number> {
    try {
      await access(audioPath);
    } catch {
      throw new Error(`Audio file is missing: ${audioPath}`);
    }

    const paths = await this.getBinaryPaths();
    const result = await this.runCommand(paths.ffprobePath, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      audioPath,
    ]);
    const durationSeconds = Number.parseFloat(result.stdout.trim());

    if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
      throw new Error(`Could not read audio duration for ${audioPath}`);
    }

    return Math.round(durationSeconds);
  }

  private getBinaryPaths(): Promise<ResolvedBinaryPaths> {
    if (this.resolvedPaths == null) {
      this.resolvedPaths = resolveBinaryPaths(this.options.binaryDir);
    }

    return this.resolvedPaths;
  }
}

type ResolvedBinaryPaths = {
  ffmpegPath: string;
  ffprobePath: string;
};

async function resolveBinaryPaths(
  binaryDir = path.join(process.cwd(), "tools", "ffmpeg", "bin"),
): Promise<ResolvedBinaryPaths> {
  const ffmpegPath = await requireProjectBinary(binaryDir, "ffmpeg.exe");
  const ffprobePath = await requireProjectBinary(binaryDir, "ffprobe.exe");

  return { ffmpegPath, ffprobePath };
}

async function requireProjectBinary(
  binaryDir: string,
  fileName: "ffmpeg.exe" | "ffprobe.exe",
): Promise<string> {
  const binaryPath = path.join(binaryDir, fileName);

  try {
    await access(binaryPath);
  } catch {
    throw new Error(
      `Project FFmpeg binary is missing: ${path.relative(process.cwd(), binaryPath)}`,
    );
  }

  return binaryPath;
}

function createConcatList(chunkAudioPaths: string[]): string {
  return chunkAudioPaths
    .map((chunkAudioPath) => `file '${escapeConcatPath(chunkAudioPath)}'`)
    .join("\n");
}

function escapeConcatPath(filePath: string): string {
  return path.resolve(filePath).replace(/\\/g, "/").replace(/'/g, "'\\''");
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_") || "part.mp3";
}

function runCommandWithSpawn(
  command: string,
  args: string[],
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";

    if (!child.stdout || !child.stderr) {
      reject(new Error(`Failed to spawn ${command}`));
      return;
    }

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          `${command} exited with code ${code ?? "unknown"}: ${stderr.trim()}`,
        ),
      );
    });
  });
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown audio assembly error";
}
