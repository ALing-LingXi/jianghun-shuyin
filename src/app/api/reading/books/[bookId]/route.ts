import { NextResponse } from "next/server";
import { z } from "zod";
import { createReadingContainer } from "@/server/composition/readingContainer";
import { readingBookDetailSchema } from "@/shared/schemas/reading";

const paramsSchema = z.object({
  bookId: z.string().uuid(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return validationError("Invalid reading book id");
  }

  const container = createReadingContainer();
  const book = await container.queryReadingBook(parsedParams.data.bookId);

  if (!book) {
    return NextResponse.json(
      { error: { code: "READING_BOOK_NOT_FOUND", message: "Reading book not found" } },
      { status: 404 },
    );
  }

  return NextResponse.json(readingBookDetailSchema.parse(book), { status: 200 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return validationError("Invalid reading book id");
  }

  const container = createReadingContainer();
  const result = await container.deleteReadingBook(parsedParams.data.bookId);

  if (!result.deleted) {
    return NextResponse.json(
      { error: { code: "READING_BOOK_NOT_FOUND", message: "Reading book not found" } },
      { status: 404 },
    );
  }

  return new NextResponse(null, { status: 204 });
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
