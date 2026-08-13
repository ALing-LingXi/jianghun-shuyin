import { NextResponse } from "next/server";
import { z } from "zod";
import { PauseJobGenerationError } from "@/server/application/pauseJobGeneration";
import { createContainer } from "@/server/composition/container";
import { jobSchema } from "@/shared/schemas/job";

const jobIdSchema = z.object({
  jobId: z.string().uuid(),
});

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const parsedParams = jobIdSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid job id",
        },
      },
      { status: 400 },
    );
  }

  try {
    const container = createContainer();
    const job = await container.pauseJobGeneration({
      jobId: parsedParams.data.jobId,
    });

    return NextResponse.json(
      jobSchema.parse({
        ...job,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
      }),
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof PauseJobGenerationError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.code === "JOB_NOT_FOUND" ? 404 : 409 },
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "PAUSE_JOB_FAILED",
          message: "Could not pause job generation",
        },
      },
      { status: 500 },
    );
  }
}
