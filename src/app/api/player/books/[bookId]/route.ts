import { readFile } from "node:fs/promises";
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
    if (!part || part.bookId !== parsedParams.data.bookId || !part.audioPath) {
      return NextResponse.json(
        { error: { code: "PART_NOT_FOUND", message: "Part not found" } },
        { status: 404 },
      );
    }

    let audio: Buffer;
    try {
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

    return new NextResponse(new Uint8Array(audio), {
      status: 200,
      headers: {
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
