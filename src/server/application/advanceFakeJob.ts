import type { Job } from "../domain/entities";
import type { JobStage, JobStatus } from "../../shared/types/entities";

export type FakeJobTransition = {
  status: JobStatus;
  stage: JobStage;
  progress: number;
  errorMessage: string | null;
};

const FAKE_JOB_STEPS: Array<{ stage: JobStage; progress: number }> = [
  { stage: "decoding", progress: 10 },
  { stage: "cleaning", progress: 30 },
  { stage: "chapter_detection", progress: 50 },
  { stage: "planning", progress: 70 },
  { stage: "tts", progress: 85 },
  { stage: "assembling", progress: 95 },
];

export function advanceFakeJob(job: Job): FakeJobTransition | null {
  if (job.status === "queued") {
    return {
      status: "processing",
      stage: FAKE_JOB_STEPS[0].stage,
      progress: FAKE_JOB_STEPS[0].progress,
      errorMessage: null,
    };
  }

  if (job.status !== "processing") {
    return null;
  }

  const currentStepIndex = FAKE_JOB_STEPS.findIndex(
    (step) => step.stage === job.stage,
  );
  const nextStep = FAKE_JOB_STEPS[currentStepIndex + 1];

  if (!nextStep) {
    return {
      status: "completed",
      stage: "completed",
      progress: 100,
      errorMessage: null,
    };
  }

  return {
    status: "processing",
    stage: nextStep.stage,
    progress: Math.max(job.progress, nextStep.progress),
    errorMessage: null,
  };
}
