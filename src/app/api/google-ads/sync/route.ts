import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { googleAdsConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import {
  refreshAccessToken,
  fetchCampaignsFromAds,
} from "@/lib/google-ads/client";

export async function POST(request: Request) {
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

  if (!connection?.customerId) {
    return NextResponse.json(
      { error: "Not connected to Google Ads" },
      { status: 400 },
    );
  }

  const body = await request.json();
  const campaignResourceNames: string[] = body.campaignResourceNames;

  if (!campaignResourceNames || campaignResourceNames.length === 0) {
    return NextResponse.json(
      { error: "No campaign resource names provided" },
      { status: 400 },
    );
  }

  let accessToken: string;
  try {
    const refreshToken = await decrypt(connection.refreshTokenEncrypted!);
    accessToken = await refreshAccessToken(refreshToken);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Token refresh failed";
    return NextResponse.json(
      {
        error: `Google Ads disconnected: ${message}. Please reconnect.`,
        reconnect: true,
      },
      { status: 401 },
    );
  }

  try {
    const syncedCampaigns = await fetchCampaignsFromAds(
      accessToken,
      connection.customerId,
      campaignResourceNames,
    );

    return NextResponse.json({ campaigns: syncedCampaigns });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
