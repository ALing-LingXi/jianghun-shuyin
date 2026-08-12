import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
    const targetDir = path.join(this.rootDir, input.subdirectory ?? "sources");
    await mkdir(targetDir, { recursive: true });
    const safeName = sanitizeFileName(input.fileName, "source.txt");
    const filePath = path.join(targetDir, `${randomUUID()}-${safeName}`);
    await writeFile(filePath, input.content, "utf8");

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
}

function sanitizeFileName(fileName: string, fallback: string): string {
  return fileName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_") || fallback;
}
