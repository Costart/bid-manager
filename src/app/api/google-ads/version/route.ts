import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    version: "v23",
    timestamp: new Date().toISOString(),
  });
}
