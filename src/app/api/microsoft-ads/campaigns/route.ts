import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { microsoftAdsConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import {
  getCampaigns,
  getAdGroupsByCampaignId,
} from "@/lib/microsoft-ads/client";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const connection = await db
    .select()
    .from(microsoftAdsConnections)
    .where(eq(microsoftAdsConnections.userId, session.user.id))
    .get();

  if (!connection?.accountId || !connection?.customerId) {
    return NextResponse.json({ error: "No account selected" }, { status: 400 });
  }

  if (!connection.accessTokenEncrypted) {
    return NextResponse.json(
      { error: "Session expired. Please reconnect Microsoft Ads." },
      { status: 401 },
    );
  }

  try {
    const accessToken = await decrypt(connection.accessTokenEncrypted);

    const campaigns = await getCampaigns(
      accessToken,
      connection.accountId,
      connection.customerId,
    );

    // Fetch ad groups for each campaign
    const url = new URL(request.url);
    const campaignId = url.searchParams.get("campaignId");

    if (campaignId) {
      const adGroups = await getAdGroupsByCampaignId(
        accessToken,
        connection.accountId,
        connection.customerId,
        campaignId,
      );
      return NextResponse.json({ adGroups });
    }

    return NextResponse.json({ campaigns });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch campaigns";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
