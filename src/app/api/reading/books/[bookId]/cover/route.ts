import { NextResponse } from "next/server";
import { z } from "zod";
import { createReadingContainer } from "@/server/composition/readingContainer";

const paramsSchema = z.object({
  bookId: z.string().uuid(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid reading book id" } },
      { status: 400 },
    );
  }

  const container = createReadingContainer();
  const cover = await container.readReadingCover(parsedParams.data.bookId);

  if (!cover) {
    return NextResponse.json(
      { error: { code: "COVER_NOT_FOUND", message: "Cover not found" } },
      { status: 404 },
    );
  }

  return new NextResponse(new Blob([toBlobPart(cover.content)]), {
    status: 200,
    headers: {
      "Content-Type": contentTypeFromFilePath(cover.filePath),
      "Cache-Control": "private, max-age=3600",
    },
  });
}

function toBlobPart(content: Uint8Array): ArrayBuffer {
  return content.buffer.slice(
    content.byteOffset,
    content.byteOffset + content.byteLength,
  ) as ArrayBuffer;
}

function contentTypeFromFilePath(filePath: string): string {
  const lower = filePath.toLocaleLowerCase();

  if (lower.endsWith(".png")) {
    return "image/png";
  }

  if (lower.endsWith(".webp")) {
    return "image/webp";
  }

  if (lower.endsWith(".gif")) {
    return "image/gif";
  }

  return "image/jpeg";
}
