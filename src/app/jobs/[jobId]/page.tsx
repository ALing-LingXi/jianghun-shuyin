import { JobPage } from "@/features/job/job-page";

export default async function JobRoutePage({
  params,
}: Readonly<{
  params: Promise<{ jobId: string }>;
}>) {
  const { jobId } = await params;
  return <JobPage jobId={jobId} />;
}
