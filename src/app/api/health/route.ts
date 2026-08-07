import { NextResponse } from "next/server";
import { createHealthResponse } from "@/shared/health";

export function GET() {
  return NextResponse.json(createHealthResponse());
}
