import { NextResponse } from "next/server";
import { createContainer } from "@/server/composition/container";
import {
  uploadFileSchema,
  uploadTextResponseSchema,
} from "@/shared/schemas/upload";

const container = createContainer();

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!formData || !(file instanceof File)) {
    return validationError("A TXT file is required");
  }

  const parsed = uploadFileSchema.safeParse({
    title: formData.get("title"),
    author: optionalFormValue(formData.get("author")),
    fileName: file.name,
    fileSize: file.size,
    voice: formData.get("voice"),
    rate: formData.get("rate"),
    pitch: formData.get("pitch"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid TXT upload",
          issues: parsed.error.issues,
        },
      },
      { status: 400 },
    );
  }

  try {
    const source = new Uint8Array(await file.arrayBuffer());
    const result = await container.createBookJob({
      title: parsed.data.title,
      author: parsed.data.author,
      fileName: parsed.data.fileName,
      voice: parsed.data.voice,
      rate: parsed.data.rate,
      pitch: parsed.data.pitch,
      source,
    });

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

function optionalFormValue(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
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
