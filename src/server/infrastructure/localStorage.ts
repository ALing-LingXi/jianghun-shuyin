import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { FileStorage, StoreTextInput } from "@/server/ports/storage";

export class LocalStorage implements FileStorage {
  constructor(private readonly rootDir: string) {}

  async saveTextSource(input: StoreTextInput): Promise<string> {
    const sourcesDir = path.join(this.rootDir, "sources");
    await mkdir(sourcesDir, { recursive: true });

    const safeName =
      input.fileName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_") || "source.txt";
    const filePath = path.join(sourcesDir, `${randomUUID()}-${safeName}`);
    await writeFile(filePath, input.content, "utf8");

    return filePath;
  }
}
