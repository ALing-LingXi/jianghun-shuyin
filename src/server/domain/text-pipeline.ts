export type TextEncoding = "utf-8" | "gbk" | "big5";

export type DecodeTextOptions = {
  preferredEncoding?: TextEncoding;
};

export type DecodeTextResult = {
  text: string;
  encoding: TextEncoding;
  byteLength: number;
  hadBom: boolean;
  warnings: string[];
};

export type CleanTextResult = {
  text: string;
  originalLength: number;
  cleanedLength: number;
  removedBom: boolean;
  normalizedNewlineCount: number;
  collapsedBlankLineCount: number;
  trimmedBlankLineCount: number;
};

export type DetectedChapter = {
  index: number;
  title: string;
  startLine: number;
  endLine: number;
  text: string;
};

export type DetectChaptersResult = {
  chapters: DetectedChapter[];
  detectedHeadingCount: number;
};

export type PlanPartsOptions = {
  fallbackTitle?: string;
  maxPartCharacters?: number;
  estimatedCharactersPerSecond?: number;
};

export type PlannedPart = {
  index: number;
  title: string;
  text: string;
  chapterIndex: number | null;
  segmentIndex: number;
  segmentCount: number;
  characterCount: number;
  estimatedDurationSeconds: number;
};

export type PlanPartsResult = {
  parts: PlannedPart[];
  fallbackUsed: boolean;
  maxPartCharacters: number;
  estimatedCharactersPerSecond: number;
};

export type BuildReportInput = {
  decode: DecodeTextResult;
  clean: CleanTextResult;
  chapters: DetectChaptersResult;
  plan: PlanPartsResult;
};

export type TextPipelineReport = {
  encoding: TextEncoding;
  byteLength: number;
  originalCharacters: number;
  cleanedCharacters: number;
  chapterCount: number;
  partCount: number;
  fallbackUsed: boolean;
  estimatedDurationSeconds: number;
  notices: string[];
};
