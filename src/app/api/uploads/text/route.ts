import { NextResponse } from "next/server";
import { createContainer } from "@/server/composition/container";
import {
  uploadTextResponseSchema,
  uploadTextSchema,
} from "@/shared/schemas/upload";

const container = createContainer();

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = uploadTextSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid upload payload",
          issues: parsed.error.issues,
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await container.createBookJob(parsed.data);
    return NextResponse.json(uploadTextResponseSchema.parse(result), {
      status: 201,
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "CREATE_BOOK_JOB_FAILED",
          message: "Could not create book and job",
        },
      },
      { status: 500 },
    );
  }
}
