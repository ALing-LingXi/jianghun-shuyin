import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  FileStorage,
  StoreBinaryInput,
  StoreTextInput,
} from "@/server/ports/storage";

export class LocalStorage implements FileStorage {
  constructor(private readonly rootDir: string) {}

  async saveTextSource(input: StoreTextInput): Promise<string> {
    return this.saveSource(
      input.content,
      input.fileName,
      input.subdirectory,
      "utf8",
    );
  }

  async saveBinarySource(input: StoreBinaryInput): Promise<string> {
    return this.saveSource(input.content, input.fileName, input.subdirectory);
  }

  private async saveSource(
    content: string | Uint8Array,
    fileName: string,
    subdirectory?: string,
    encoding?: "utf8",
  ): Promise<string> {
    const targetDir = path.join(this.rootDir, subdirectory ?? "sources");
    await mkdir(targetDir, { recursive: true });
    const safeName = sanitizeFileName(fileName, "source.txt");
    const filePath = path.join(targetDir, `${randomUUID()}-${safeName}`);
    if (typeof content === "string") {
      await writeFile(filePath, content, encoding ?? "utf8");
    } else {
      await writeFile(filePath, content);
    }

    return filePath;
  }

  async readTextSource(sourcePath: string): Promise<Uint8Array> {
    return readFile(sourcePath);
  }

  async saveChunkAudio(input: StoreBinaryInput): Promise<string> {
    const targetDir = path.join(this.rootDir, input.subdirectory ?? "chunks");
    await mkdir(targetDir, { recursive: true });
    const safeName = sanitizeFileName(input.fileName, "chunk.mp3");
    const filePath = path.join(targetDir, `${randomUUID()}-${safeName}`);
    await writeFile(filePath, input.content);

    return filePath;
  }

  async deleteFile(filePath: string): Promise<void> {
    const root = path.resolve(this.rootDir);
    const target = path.resolve(filePath);

    if (target === root || !target.startsWith(`${root}${path.sep}`)) {
      return;
    }

    await rm(target, { force: true });
  }

  async exists(filePath: string): Promise<boolean> {
    const root = path.resolve(this.rootDir);
    const target = path.resolve(filePath);

    if (target === root || !target.startsWith(`${root}${path.sep}`)) {
      return false;
    }

    try {
      await access(target);
      return true;
    } catch {
      return false;
    }
  }
}

function sanitizeFileName(fileName: string, fallback: string): string {
  return fileName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_") || fallback;
}
