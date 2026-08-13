import { NextResponse } from "next/server";
import { createReadingContainer } from "@/server/composition/readingContainer";
import { readingLibrarySchema } from "@/shared/schemas/reading";

export async function GET() {
  const container = createReadingContainer();
  const library = await container.queryReadingLibrary();

  return NextResponse.json(readingLibrarySchema.parse(library), { status: 200 });
}
