import { NextResponse } from "next/server";
import { createContainer } from "@/server/composition/container";
import { librarySchema } from "@/shared/schemas/library";

export async function GET() {
  const container = createContainer();
  const library = await container.queryLibrary();

  return NextResponse.json(librarySchema.parse(library), { status: 200 });
}
