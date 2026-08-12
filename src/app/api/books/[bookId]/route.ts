import { NextResponse } from "next/server";
import { z } from "zod";
import { createContainer } from "@/server/composition/container";

const paramsSchema = z.object({
  bookId: z.string().uuid(),
});

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid book id" } },
      { status: 400 },
    );
  }

  const container = createContainer();
  const result = await container.deleteBook(parsedParams.data.bookId);

  if (!result.deleted) {
    return NextResponse.json(
      { error: { code: "BOOK_NOT_FOUND", message: "Book not found" } },
      { status: 404 },
    );
  }

  return new NextResponse(null, { status: 204 });
}
