import type { TextEncoding } from "@/server/domain/text-pipeline";
import { cleanText, decodeText } from "@/server/pipeline";

export type CleanTextFileInput = {
  fileName: string;
  source: Uint8Array;
  preferredEncoding?: TextEncoding;
};

export type CleanTextFileResult = {
  text: string;
  downloadFileName: string;
  encoding: TextEncoding;
  byteLength: number;
  originalCharacters: number;
  cleanedCharacters: number;
  removedBom: boolean;
  normalizedNewlineCount: number;
  collapsedBlankLineCount: number;
  trimmedBlankLineCount: number;
};

export function cleanTextFile(
  input: CleanTextFileInput,
): CleanTextFileResult {
  const decoded = decodeText(input.source, {
    preferredEncoding: input.preferredEncoding,
  });
  const cleaned = cleanText(decoded.text);

  return {
    text: cleaned.text,
    downloadFileName: buildDownloadFileName(input.fileName),
    encoding: decoded.encoding,
    byteLength: decoded.byteLength,
    originalCharacters: cleaned.originalLength,
    cleanedCharacters: cleaned.cleanedLength,
    removedBom: decoded.hadBom || cleaned.removedBom,
    normalizedNewlineCount: cleaned.normalizedNewlineCount,
    collapsedBlankLineCount: cleaned.collapsedBlankLineCount,
    trimmedBlankLineCount: cleaned.trimmedBlankLineCount,
  };
}

function buildDownloadFileName(fileName: string): string {
  const sourceName = fileName.trim().replace(/\.txt$/i, "").trim();
  const safeName = sanitizeFileName(sourceName || "cleaned");
  return `${safeName}.cleaned.txt`;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_") || "cleaned";
}
