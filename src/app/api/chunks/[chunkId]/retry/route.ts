import { NextResponse } from "next/server";
import { z } from "zod";
import { createContainer } from "@/server/composition/container";
import { RetryChunkError } from "@/server/application/retryChunk";

const chunkIdSchema = z.object({
  chunkId: z.string().uuid(),
});

const retryChunkBodySchema = z.object({
  text: z.string().trim().min(1),
  voice: z.string().trim().min(1),
  rate: z.string().trim().min(1),
  pitch: z.string().trim().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ chunkId: string }> },
) {
  const parsedParams = chunkIdSchema.safeParse(await params);
  const parsedBody = retryChunkBodySchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsedParams.success || !parsedBody.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid retry payload",
        },
      },
      { status: 400 },
    );
  }

  try {
    const container = createContainer();
    const chunk = await container.retryChunk({
      chunkId: parsedParams.data.chunkId,
      ...parsedBody.data,
    });

    return NextResponse.json(chunk, { status: 200 });
  } catch (error) {
    if (error instanceof RetryChunkError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: statusForRetryChunkError(error) },
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "CHUNK_RETRY_FAILED",
          message: "Could not retry chunk",
        },
      },
      { status: 500 },
    );
  }
}

function statusForRetryChunkError(error: RetryChunkError): number {
  if (error.code === "CHUNK_NOT_FOUND") {
    return 404;
  }

  if (
    error.code === "CHUNK_NOT_FAILED" ||
    error.code === "CHUNK_RETRY_KEY_MISMATCH"
  ) {
    return 409;
  }

  return 500;
}
