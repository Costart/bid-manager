import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { googleAdsConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import {
  refreshAccessToken,
  fetchSearchTermReport,
} from "@/lib/google-ads/client";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const connection = await db
    .select()
    .from(googleAdsConnections)
    .where(eq(googleAdsConnections.userId, session.user.id))
    .get();

  if (!connection || !connection.customerId) {
    return NextResponse.json(
      { error: "Not connected to Google Ads or no account selected" },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get("days") || "30", 10);
  const conversionsOnly = url.searchParams.get("conversionsOnly") !== "false";

  let accessToken: string;
  try {
    const refreshToken = await decrypt(connection.refreshTokenEncrypted!);
    accessToken = await refreshAccessToken(refreshToken);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Token refresh failed";
    return NextResponse.json(
      { error: `Google Ads disconnected: ${message}. Please reconnect.` },
      { status: 401 },
    );
  }

  try {
    const results = await fetchSearchTermReport(
      accessToken,
      connection.customerId,
      days,
      conversionsOnly,
    );
    return NextResponse.json({ results });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch search terms";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
