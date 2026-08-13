import { NextResponse } from "next/server";
import { createReadingContainer } from "@/server/composition/readingContainer";
import {
  readingUploadResponseSchema,
  readingUploadSchema,
} from "@/shared/schemas/reading";

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const cover = formData?.get("cover");

  if (!formData || !(file instanceof File) || !(cover instanceof File)) {
    return validationError("TXT 文件和封面都是必填项");
  }

  const parsed = readingUploadSchema.safeParse({
    title: formData.get("title"),
    author: optionalFormValue(formData.get("author")),
    fileName: file.name,
    fileSize: file.size,
    coverFileName: cover.name,
    coverFileSize: cover.size,
    coverMimeType: cover.type,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "阅读书籍上传信息无效",
          issues: parsed.error.issues,
        },
      },
      { status: 400 },
    );
  }

  try {
    const container = createReadingContainer();
    const result = await container.createReadingBook({
      title: parsed.data.title,
      author: parsed.data.author,
      fileName: parsed.data.fileName,
      coverFileName: parsed.data.coverFileName,
      source: new Uint8Array(await file.arrayBuffer()),
      cover: new Uint8Array(await cover.arrayBuffer()),
    });

    return NextResponse.json(readingUploadResponseSchema.parse(result), {
      status: 201,
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "CREATE_READING_BOOK_FAILED",
          message: "创建阅读书籍失败，请检查 TXT 内容后重试",
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
