import { NextResponse } from "next/server";
import { z } from "zod";
import { RetryPartError } from "@/server/application/retryPart";
import { createContainer } from "@/server/composition/container";

const partIdSchema = z.object({
  partId: z.string().uuid(),
});

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ partId: string }> },
) {
  const parsedParams = partIdSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid part id",
        },
      },
      { status: 400 },
    );
  }

  try {
    const container = createContainer();
    const part = await container.retryPart({
      partId: parsedParams.data.partId,
    });

    return NextResponse.json(part, { status: 200 });
  } catch (error) {
    if (error instanceof RetryPartError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: statusForRetryPartError(error) },
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "PART_RETRY_FAILED",
          message: "Could not retry part",
        },
      },
      { status: 500 },
    );
  }
}

function statusForRetryPartError(error: RetryPartError): number {
  if (error.code === "PART_NOT_FOUND" || error.code === "PART_JOB_NOT_FOUND") {
    return 404;
  }

  return 409;
}
