import { NextResponse } from "next/server";
import { z } from "zod";
import { createContainer } from "@/server/composition/container";
import { jobSchema } from "@/shared/schemas/job";

const jobIdSchema = z.object({
  jobId: z.string().uuid(),
});

function toJobDto(job: {
  id: string;
  bookId: string;
  status: string;
  stage: string;
  progress: number;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return jobSchema.parse({
    ...job,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  });
}

export async function GET(
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

  const container = createContainer();
  const job = await container.queryJob(parsedParams.data.jobId);

  if (!job) {
    return NextResponse.json(
      {
        error: {
          code: "JOB_NOT_FOUND",
          message: "Job not found",
        },
      },
      { status: 404 },
    );
  }

  return NextResponse.json(toJobDto(job), { status: 200 });
}
