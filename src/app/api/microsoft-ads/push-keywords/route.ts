import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { microsoftAdsConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { addKeywordsToAdGroup } from "@/lib/microsoft-ads/client";

interface KeywordPayload {
  adGroupId: string;
  keywords: { text: string; matchType: string; bid: number }[];
}

export async function POST(request: Request) {
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
    return NextResponse.json(
      { error: "No Microsoft Ads account selected" },
      { status: 400 },
    );
  }

  if (!connection.accessTokenEncrypted) {
    return NextResponse.json(
      { error: "Session expired. Please reconnect Microsoft Ads." },
      { status: 401 },
    );
  }

  const body = await request.json();
  const groups: KeywordPayload[] = body.groups;

  if (!groups || groups.length === 0) {
    return NextResponse.json({ error: "No keywords to push" }, { status: 400 });
  }

  let accessToken: string;
  try {
    accessToken = await decrypt(connection.accessTokenEncrypted);
  } catch (err) {
    return NextResponse.json(
      { error: "Session expired. Please reconnect Microsoft Ads." },
      { status: 401 },
    );
  }

  const results = [];
  for (const group of groups) {
    try {
      const result = await addKeywordsToAdGroup(
        accessToken,
        connection.accountId,
        connection.customerId,
        group.adGroupId,
        group.keywords,
      );
      results.push({
        adGroupId: group.adGroupId,
        success: true,
        added: result.filter((r) => r.success).length,
        total: group.keywords.length,
      });
    } catch (err) {
      results.push({
        adGroupId: group.adGroupId,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        added: 0,
        total: group.keywords.length,
      });
    }
  }

  return NextResponse.json({ results });
}
