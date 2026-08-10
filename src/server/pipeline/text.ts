import type {
  BuildReportInput,
  CleanTextResult,
  DecodeTextOptions,
  DecodeTextResult,
  DetectedChapter,
  DetectChaptersResult,
  PlannedPart,
  PlanPartsOptions,
  PlanPartsResult,
  TextEncoding,
  TextPipelineReport,
} from "@/server/domain/text-pipeline";

const SUPPORTED_ENCODINGS: TextEncoding[] = ["utf-8", "gbk", "big5"];
const UTF8_BOM = [0xef, 0xbb, 0xbf] as const;
const DEFAULT_FALLBACK_TITLE = "正文";
const DEFAULT_MAX_PART_CHARACTERS = 3000;
const DEFAULT_ESTIMATED_CHARACTERS_PER_SECOND = 5;

export function decodeText(
  input: Uint8Array | ArrayBuffer,
  options: DecodeTextOptions = {},
): DecodeTextResult {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const hadBom = hasUtf8Bom(bytes);
  const candidates = uniqueEncodings([
    options.preferredEncoding,
    hadBom ? "utf-8" : undefined,
    ...SUPPORTED_ENCODINGS,
  ]);
  const warnings: string[] = [];

  for (const encoding of candidates) {
    try {
      return {
        text: new TextDecoder(encoding, { fatal: true }).decode(bytes),
        encoding,
        byteLength: bytes.byteLength,
        hadBom,
        warnings,
      };
    } catch {
      warnings.push(`decode_failed:${encoding}`);
    }
  }

  return {
    text: new TextDecoder("utf-8", { fatal: false }).decode(bytes),
    encoding: "utf-8",
    byteLength: bytes.byteLength,
    hadBom,
    warnings: [...warnings, "decode_fallback:utf-8-replacement"],
  };
}

export function cleanText(text: string): CleanTextResult {
  const originalLength = text.length;
  const removedBom = text.startsWith("\uFEFF");
  const normalizedNewlineCount = (text.match(/\r\n|\r/g) ?? []).length;
  const normalized = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n|\r/g, "\n")
    .replace(/\u00a0/g, " ");
  const lines = normalized.split("\n").map((line) => line.replace(/[ \t\u3000]+$/g, ""));
  const beforeTrimLength = lines.length;
  const trimmedLines = trimOuterBlankLines(lines);
  const trimmedBlankLineCount = beforeTrimLength - trimmedLines.length;
  const { lines: collapsedLines, collapsedBlankLineCount } =
    collapseBlankLines(trimmedLines);
  const cleaned = collapsedLines.join("\n");

  return {
    text: cleaned,
    originalLength,
    cleanedLength: cleaned.length,
    removedBom,
    normalizedNewlineCount,
    collapsedBlankLineCount,
    trimmedBlankLineCount,
  };
}

export function detectChapters(text: string): DetectChaptersResult {
  const lines = text.split("\n");
  const headings = lines
    .map((line, lineIndex) => ({ title: line.trim(), lineIndex }))
    .filter(({ title }) => isChapterHeading(title));

  if (headings.length === 0) {
    return {
      chapters: [],
      detectedHeadingCount: 0,
    };
  }

  const chapters: DetectedChapter[] = [];
  const firstHeading = headings[0];
  const prefaceText = lines.slice(0, firstHeading.lineIndex).join("\n").trim();

  if (prefaceText.length > 0) {
    chapters.push({
      index: chapters.length,
      title: "前言",
      startLine: 0,
      endLine: firstHeading.lineIndex - 1,
      text: prefaceText,
    });
  }

  for (let headingIndex = 0; headingIndex < headings.length; headingIndex += 1) {
    const heading = headings[headingIndex];
    const nextHeading = headings[headingIndex + 1];
    const endLine = nextHeading ? nextHeading.lineIndex - 1 : lines.length - 1;
    const chapterText = lines.slice(heading.lineIndex, endLine + 1).join("\n").trim();

    if (chapterText.length === 0) {
      continue;
    }

    chapters.push({
      index: chapters.length,
      title: heading.title,
      startLine: heading.lineIndex,
      endLine,
      text: chapterText,
    });
  }

  return {
    chapters,
    detectedHeadingCount: headings.length,
  };
}

export function planParts(
  text: string,
  chapters: DetectedChapter[],
  options: PlanPartsOptions = {},
): PlanPartsResult {
  const maxPartCharacters =
    options.maxPartCharacters ?? DEFAULT_MAX_PART_CHARACTERS;
  const estimatedCharactersPerSecond =
    options.estimatedCharactersPerSecond ??
    DEFAULT_ESTIMATED_CHARACTERS_PER_SECOND;
  const sourceChapters =
    chapters.length > 0
      ? chapters
      : buildFallbackChapters(text, options.fallbackTitle ?? DEFAULT_FALLBACK_TITLE);
  const parts: PlannedPart[] = [];

  for (const chapter of sourceChapters) {
    const segments = splitTextForParts(chapter.text, maxPartCharacters);

    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
      const segment = segments[segmentIndex];

      parts.push({
        index: parts.length,
        title:
          segments.length === 1
            ? chapter.title
            : `${chapter.title} (${segmentIndex + 1}/${segments.length})`,
        text: segment,
        chapterIndex: chapter.index,
        segmentIndex,
        segmentCount: segments.length,
        characterCount: segment.length,
        estimatedDurationSeconds: Math.max(
          1,
          Math.ceil(segment.length / estimatedCharactersPerSecond),
        ),
      });
    }
  }

  return {
    parts,
    fallbackUsed: chapters.length === 0 && text.trim().length > 0,
    maxPartCharacters,
    estimatedCharactersPerSecond,
  };
}

export function buildReport(input: BuildReportInput): TextPipelineReport {
  const estimatedDurationSeconds = input.plan.parts.reduce(
    (total, part) => total + part.estimatedDurationSeconds,
    0,
  );
  const notices = [
    ...input.decode.warnings,
    input.decode.encoding !== "utf-8"
      ? `non_utf8_encoding:${input.decode.encoding}`
      : undefined,
    input.clean.removedBom ? "removed_bom" : undefined,
    input.clean.normalizedNewlineCount > 0 ? "normalized_newlines" : undefined,
    input.clean.collapsedBlankLineCount > 0 ? "collapsed_blank_lines" : undefined,
    input.plan.fallbackUsed ? "fallback_single_chapter" : undefined,
  ].filter((notice): notice is string => notice !== undefined);

  return {
    encoding: input.decode.encoding,
    byteLength: input.decode.byteLength,
    originalCharacters: input.clean.originalLength,
    cleanedCharacters: input.clean.cleanedLength,
    chapterCount: input.chapters.chapters.length,
    partCount: input.plan.parts.length,
    fallbackUsed: input.plan.fallbackUsed,
    estimatedDurationSeconds,
    notices,
  };
}

function hasUtf8Bom(bytes: Uint8Array): boolean {
  return (
    bytes.length >= UTF8_BOM.length &&
    bytes[0] === UTF8_BOM[0] &&
    bytes[1] === UTF8_BOM[1] &&
    bytes[2] === UTF8_BOM[2]
  );
}

function uniqueEncodings(encodings: Array<TextEncoding | undefined>): TextEncoding[] {
  return encodings.filter(
    (encoding, index): encoding is TextEncoding =>
      encoding !== undefined && encodings.indexOf(encoding) === index,
  );
}

function trimOuterBlankLines(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start].trim().length === 0) {
    start += 1;
  }

  while (end > start && lines[end - 1].trim().length === 0) {
    end -= 1;
  }

  return lines.slice(start, end);
}

function collapseBlankLines(lines: string[]): {
  lines: string[];
  collapsedBlankLineCount: number;
} {
  const collapsed: string[] = [];
  let blankRun = 0;
  let collapsedBlankLineCount = 0;

  for (const line of lines) {
    if (line.trim().length === 0) {
      blankRun += 1;

      if (blankRun === 1) {
        collapsed.push("");
      } else {
        collapsedBlankLineCount += 1;
      }

      continue;
    }

    blankRun = 0;
    collapsed.push(line);
  }

  return { lines: collapsed, collapsedBlankLineCount };
}

function isChapterHeading(title: string): boolean {
  if (title.length === 0 || title.length > 60) {
    return false;
  }

  if (/[。！？!?；;]/.test(title)) {
    return false;
  }

  return [
    /^第\s*[0-9０-９一二三四五六七八九十百千万萬零〇两兩壹贰叁肆伍陆柒捌玖拾佰仟]+\s*[章节回卷部篇幕集](?:\s*[：:、.\-]\s*\S.{0,40}|\s+\S.{0,40}|)$/,
    /^(序章|楔子|前言|后记|尾声|番外)(\s*[:：、.-]\s*.{0,40})?$/,
    /^(chapter|chap\.?)\s+[0-9]+(\s*[:：、.-]\s*.{0,40})?$/i,
    /^[0-9０-９]{1,4}\s*[.．、]\s*\S.{0,40}$/,
  ].some((pattern) => pattern.test(title));
}

function buildFallbackChapters(
  text: string,
  fallbackTitle: string,
): DetectedChapter[] {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return [];
  }

  const lineCount = trimmed.split("\n").length;

  return [
    {
      index: 0,
      title: fallbackTitle,
      startLine: 0,
      endLine: lineCount - 1,
      text: trimmed,
    },
  ];
}

function splitTextForParts(text: string, maxPartCharacters: number): string[] {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return [];
  }

  if (trimmed.length <= maxPartCharacters) {
    return [trimmed];
  }

  const blocks = trimmed.split(/\n+/).map((block) => block.trim()).filter(Boolean);
  const segments: string[] = [];
  let current = "";

  for (const block of blocks) {
    if (block.length > maxPartCharacters) {
      if (current.length > 0) {
        segments.push(current);
        current = "";
      }

      segments.push(...splitOversizedBlock(block, maxPartCharacters));
      continue;
    }

    const candidate = current.length > 0 ? `${current}\n${block}` : block;

    if (candidate.length <= maxPartCharacters) {
      current = candidate;
    } else {
      segments.push(current);
      current = block;
    }
  }

  if (current.length > 0) {
    segments.push(current);
  }

  return segments;
}

function splitOversizedBlock(block: string, maxPartCharacters: number): string[] {
  const sentences = block.match(/[^。！？!?；;]+[。！？!?；;]?/g) ?? [block];
  const segments: string[] = [];
  let current = "";

  for (const sentence of sentences.map((value) => value.trim()).filter(Boolean)) {
    if (sentence.length > maxPartCharacters) {
      if (current.length > 0) {
        segments.push(current);
        current = "";
      }

      segments.push(...hardSplit(sentence, maxPartCharacters));
      continue;
    }

    const candidate = current.length > 0 ? `${current}${sentence}` : sentence;

    if (candidate.length <= maxPartCharacters) {
      current = candidate;
    } else {
      segments.push(current);
      current = sentence;
    }
  }

  if (current.length > 0) {
    segments.push(current);
  }

  return segments;
}

function hardSplit(text: string, maxPartCharacters: number): string[] {
  const segments: string[] = [];

  for (let start = 0; start < text.length; start += maxPartCharacters) {
    segments.push(text.slice(start, start + maxPartCharacters));
  }

  return segments;
}
