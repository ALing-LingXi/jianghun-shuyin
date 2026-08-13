import { readFile, stat } from "node:fs/promises";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createContainer } from "@/server/composition/container";
import { playerSchema } from "@/shared/schemas/player";

const paramsSchema = z.object({
  bookId: z.string().uuid(),
});

const querySchema = z.object({
  partId: z.string().uuid().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid book id" } },
      { status: 400 },
    );
  }

  const parsedQuery = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid player query" } },
      { status: 400 },
    );
  }

  const container = createContainer();

  if (parsedQuery.data.partId) {
    const part = await container.parts.findById(parsedQuery.data.partId);
    if (
      !part ||
      part.bookId !== parsedParams.data.bookId ||
      part.status !== "completed" ||
      !part.audioPath
    ) {
      return NextResponse.json(
        { error: { code: "PART_NOT_FOUND", message: "Part not found" } },
        { status: 404 },
      );
    }

    let audio: Buffer;
    let fileSize = 0;
    try {
      const fileStat = await stat(part.audioPath);
      fileSize = fileStat.size;
      audio = await readFile(part.audioPath);
    } catch {
      return NextResponse.json(
        {
          error: {
            code: "PART_AUDIO_MISSING",
            message: "Part audio file is missing",
          },
        },
        { status: 404 },
      );
    }

    const range = request.headers.get("range");
    if (range) {
      return createRangeAudioResponse(audio, fileSize, range);
    }

    return new NextResponse(new Uint8Array(audio), {
      status: 200,
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Length": String(fileSize),
        "Content-Type": "audio/mpeg",
      },
    });
  }

  const player = await container.queryPlayer(parsedParams.data.bookId);
  if (!player) {
    return NextResponse.json(
      { error: { code: "PLAYER_NOT_FOUND", message: "Player not found" } },
      { status: 404 },
    );
  }

  return NextResponse.json(playerSchema.parse(player), { status: 200 });
}

function createRangeAudioResponse(
  audio: Buffer,
  fileSize: number,
  range: string,
): NextResponse {
  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!match) {
    return createUnsatisfiableRangeResponse(fileSize);
  }

  const hasStart = Boolean(match[1]);
  const hasEnd = Boolean(match[2]);

  if (!hasStart && !hasEnd) {
    return createUnsatisfiableRangeResponse(fileSize);
  }

  let start: number;
  let end: number;

  if (!hasStart) {
    const suffixLength = Number.parseInt(match[2], 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return createUnsatisfiableRangeResponse(fileSize);
    }

    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else {
    start = Number.parseInt(match[1], 10);
    end = hasEnd ? Number.parseInt(match[2], 10) : fileSize - 1;
  }

  start = Math.max(0, start);
  end = Math.min(end, fileSize - 1);

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start > end ||
    start >= fileSize
  ) {
    return createUnsatisfiableRangeResponse(fileSize);
  }

  const chunk = audio.subarray(start, end + 1);
  return new NextResponse(new Uint8Array(chunk), {
    status: 206,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Length": String(chunk.byteLength),
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Content-Type": "audio/mpeg",
    },
  });
}

function createUnsatisfiableRangeResponse(fileSize: number): NextResponse {
  return new NextResponse(null, {
    status: 416,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Range": `bytes */${fileSize}`,
    },
  });
}
