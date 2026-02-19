import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { googleAdsConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import {
  refreshAccessToken,
  createCampaignBudget,
  createCampaign,
  createAdGroup,
  addKeywords,
  addWebpageCriterion,
  createResponsiveSearchAd,
  createExpandedDynamicSearchAd,
} from "@/lib/google-ads/client";
import type { Campaign } from "@/lib/ad-builder/types";

interface CampaignResult {
  campaignName: string;
  success: boolean;
  adGroupCount: number;
  error?: string;
}

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

  if (!connection) {
    return NextResponse.json(
      { error: "Not connected to Google Ads" },
      { status: 400 },
    );
  }

  if (!connection.customerId) {
    return NextResponse.json(
      { error: "No Google Ads account selected" },
      { status: 400 },
    );
  }

  const body = await request.json();
  const campaigns: Campaign[] = body.campaigns;

  if (!campaigns || campaigns.length === 0) {
    return NextResponse.json(
      { error: "No campaigns to upload" },
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

  const customerId = connection.customerId;
  const results: CampaignResult[] = [];

  for (const campaign of campaigns) {
    try {
      const hasDSA = campaign.adGroups.some((ag) => ag.isDSA);
      const domainUrl = campaign.adGroups[0]?.landingPageUrl;

      const budgetName = `${campaign.name} Budget - ${Date.now()}`;
      const budgetResource = await createCampaignBudget(
        accessToken,
        customerId,
        budgetName,
      );

      const campaignResource = await createCampaign(
        accessToken,
        customerId,
        campaign.name,
        budgetResource,
        hasDSA,
        domainUrl,
      );

      let adGroupCount = 0;

      for (const ag of campaign.adGroups) {
        try {
          const adGroupResource = await createAdGroup(
            accessToken,
            customerId,
            campaignResource,
            ag.name,
            !!ag.isDSA,
          );

          if (ag.isDSA) {
            await addWebpageCriterion(
              accessToken,
              customerId,
              adGroupResource,
              ag.landingPageUrl,
            );
            await createExpandedDynamicSearchAd(
              accessToken,
              customerId,
              adGroupResource,
              ag.descriptions,
            );
          } else {
            await addKeywords(
              accessToken,
              customerId,
              adGroupResource,
              ag.keywords,
            );

            let path1: string | undefined;
            let path2: string | undefined;
            try {
              const urlPath = new URL(ag.landingPageUrl).pathname;
              const segments = urlPath
                .split("/")
                .filter((s) => s.length > 0);
              path1 = segments[0]?.substring(0, 15);
              path2 = segments[1]?.substring(0, 15);
            } catch {
              // skip path extraction
            }

            await createResponsiveSearchAd(
              accessToken,
              customerId,
              adGroupResource,
              ag.headlines,
              ag.descriptions,
              ag.landingPageUrl,
              path1,
              path2,
            );
          }

          adGroupCount++;
        } catch (agErr) {
          console.error(
            `Ad group "${ag.name}" failed:`,
            agErr instanceof Error ? agErr.message : agErr,
          );
        }
      }

      results.push({
        campaignName: campaign.name,
        success: true,
        adGroupCount,
      });
    } catch (err) {
      results.push({
        campaignName: campaign.name,
        success: false,
        adGroupCount: 0,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;

  return NextResponse.json({
    results,
    summary: {
      total: campaigns.length,
      succeeded: successCount,
      failed: campaigns.length - successCount,
    },
  });
}
