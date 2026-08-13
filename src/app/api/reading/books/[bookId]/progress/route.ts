import { NextResponse } from "next/server";
import { z } from "zod";
import { createReadingContainer } from "@/server/composition/readingContainer";
import {
  readingBookSummarySchema,
  readingProgressSchema,
} from "@/shared/schemas/reading";

const paramsSchema = z.object({
  bookId: z.string().uuid(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const parsedParams = paramsSchema.safeParse(await params);
  const parsedBody = readingProgressSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsedParams.success || !parsedBody.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid reading progress" } },
      { status: 400 },
    );
  }

  const container = createReadingContainer();
  const summary = await container.updateReadingProgress(
    parsedParams.data.bookId,
    parsedBody.data.chapterIndex,
  );

  if (!summary) {
    return NextResponse.json(
      { error: { code: "READING_CHAPTER_NOT_FOUND", message: "Chapter not found" } },
      { status: 404 },
    );
  }

  return NextResponse.json(readingBookSummarySchema.parse(summary), {
    status: 200,
  });
}
