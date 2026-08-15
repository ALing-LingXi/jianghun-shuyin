import { NextResponse } from "next/server";
import { cleanTextFile } from "@/server/application/cleanTextFile";
import { textCleanUploadSchema } from "@/shared/schemas/text-clean";

const MAX_UPLOAD_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!formData || !(file instanceof File)) {
    return validationError("A TXT file is required");
  }

  const parsed = textCleanUploadSchema.safeParse({
    fileName: file.name,
    fileSize: file.size,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid TXT file",
          issues: parsed.error.issues,
        },
      },
      { status: 400 },
    );
  }

  if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
    return validationError("TXT file is too large");
  }

  try {
    const source = new Uint8Array(await file.arrayBuffer());
    const result = cleanTextFile({
      fileName: parsed.data.fileName,
      source,
    });

    return new NextResponse(result.text, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": contentDisposition(result.downloadFileName),
        "X-Download-File-Name": encodeURIComponent(result.downloadFileName),
        "X-Detected-Encoding": result.encoding,
        "X-Original-Characters": String(result.originalCharacters),
        "X-Cleaned-Characters": String(result.cleanedCharacters),
        "X-Removed-Bom": String(result.removedBom),
        "X-Normalized-Newlines": String(result.normalizedNewlineCount),
        "X-Collapsed-Blank-Lines": String(result.collapsedBlankLineCount),
        "X-Trimmed-Blank-Lines": String(result.trimmedBlankLineCount),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[text-clean] failed", error);
    return NextResponse.json(
      {
        error: {
          code: "TEXT_CLEAN_FAILED",
          message: "Could not clean text",
          detail: error instanceof Error ? error.message : String(error),
        },
      },
      { status: 500 },
    );
  }
}

function validationError(message: string) {
  return NextResponse.json(
    {
      error: {
        code: "VALIDATION_ERROR",
        message,
      },
    },
    { status: 400 },
  );
}

function contentDisposition(fileName: string): string {
  const fallback = asciiSafeFileName(fileName) || "cleaned.txt";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function asciiSafeFileName(fileName: string): string {
  return fileName
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}
