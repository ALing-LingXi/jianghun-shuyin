import { NextResponse } from "next/server";
import { z } from "zod";
import { createReadingContainer } from "@/server/composition/readingContainer";
import { readingChapterDetailSchema } from "@/shared/schemas/reading";

const paramsSchema = z.object({
  bookId: z.string().uuid(),
  chapterIndex: z.coerce.number().int().nonnegative(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bookId: string; chapterIndex: string }> },
) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid chapter request" } },
      { status: 400 },
    );
  }

  const container = createReadingContainer();
  const detail = await container.queryReadingChapter(
    parsedParams.data.bookId,
    parsedParams.data.chapterIndex,
  );

  if (!detail) {
    return NextResponse.json(
      { error: { code: "READING_CHAPTER_NOT_FOUND", message: "Chapter not found" } },
      { status: 404 },
    );
  }

  return NextResponse.json(readingChapterDetailSchema.parse(detail), {
    status: 200,
  });
}
