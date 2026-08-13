export const JOB_STATUSES = [
  "queued",
  "processing",
  "paused",
  "completed",
  "completed_with_errors",
  "failed",
  "cancelled",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STAGES = [
  "decoding",
  "cleaning",
  "chapter_detection",
  "planning",
  "tts",
  "assembling",
  "completed",
] as const;

export type JobStage = (typeof JOB_STAGES)[number];

export const BOOK_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const;

export type BookStatus = (typeof BOOK_STATUSES)[number];

export const PART_STATUSES = [
  "pending",
  "processing",
  "tts",
  "assembling",
  "completed",
  "failed",
  "cancelled",
] as const;

export type PartStatus = (typeof PART_STATUSES)[number];

export const CHUNK_STATUSES = ["pending", "processing", "completed", "failed"] as const;

export type ChunkStatus = (typeof CHUNK_STATUSES)[number];
