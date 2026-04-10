import type { SearchTermResult } from "@/lib/bid-engine/types";

const GOOGLE_ADS_API_VERSION = "v23";
const BASE_URL = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${text}`);
  }
  return res.json();
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${text}`);
  }
  const data = await res.json();
  return data.access_token;
}

function apiHeaders(accessToken: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  };
  if (process.env.GOOGLE_ADS_MCC_ID) {
    headers["login-customer-id"] = process.env.GOOGLE_ADS_MCC_ID;
  }
  return headers;
}

export async function listAccessibleCustomers(
  accessToken: string,
): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/customers:listAccessibleCustomers`, {
    headers: apiHeaders(accessToken),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`listAccessibleCustomers failed: ${text}`);
  }
  const data = await res.json();
  return data.resourceNames || [];
}

export interface CustomerInfo {
  id: string;
  name: string;
  currencyCode: string;
  isManager: boolean;
}

export async function listMccClientAccounts(
  accessToken: string,
): Promise<CustomerInfo[]> {
  const mccId = process.env.GOOGLE_ADS_MCC_ID!;
  const res = await fetch(`${BASE_URL}/customers/${mccId}/googleAds:search`, {
    method: "POST",
    headers: apiHeaders(accessToken),
    body: JSON.stringify({
      query: `SELECT
          customer_client.id,
          customer_client.descriptive_name,
          customer_client.currency_code,
          customer_client.manager,
          customer_client.status
        FROM customer_client
        WHERE customer_client.manager = false
          AND customer_client.status = 'ENABLED'`,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MCC client listing failed: ${text}`);
  }
  const data = await res.json();
  const results: CustomerInfo[] = (data.results || []).map(
    (row: { customerClient: Record<string, unknown> }) => ({
      id: String(row.customerClient.id),
      name:
        (row.customerClient.descriptiveName as string) ||
        `Account ${row.customerClient.id}`,
      currencyCode: (row.customerClient.currencyCode as string) || "USD",
      isManager: false,
    }),
  );
  return results;
}

export async function getCustomerDetails(
  accessToken: string,
  customerIds: string[],
): Promise<CustomerInfo[]> {
  const results: CustomerInfo[] = [];
  for (const customerId of customerIds) {
    try {
      const res = await fetch(
        `${BASE_URL}/customers/${customerId}/googleAds:search`,
        {
          method: "POST",
          headers: apiHeaders(accessToken),
          body: JSON.stringify({
            query: `SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager FROM customer LIMIT 1`,
          }),
        },
      );
      if (!res.ok) continue;
      const data = await res.json();
      const row = data.results?.[0]?.customer;
      if (row) {
        results.push({
          id: String(row.id),
          name: row.descriptiveName || `Account ${row.id}`,
          currencyCode: row.currencyCode || "USD",
          isManager: row.manager || false,
        });
      }
    } catch {
      // Skip accounts we cannot access
    }
  }
  return results.filter((c) => !c.isManager);
}

export async function createCampaignBudget(
  accessToken: string,
  customerId: string,
  budgetName: string,
  dailyBudgetMicros: number = 10_000_000,
): Promise<string> {
  const res = await fetch(
    `${BASE_URL}/customers/${customerId}/campaignBudgets:mutate`,
    {
      method: "POST",
      headers: apiHeaders(accessToken),
      body: JSON.stringify({
        operations: [
          {
            create: {
              name: budgetName,
              deliveryMethod: "STANDARD",
              amountMicros: String(dailyBudgetMicros),
            },
          },
        ],
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Budget creation failed: ${text}`);
  }
  const data = await res.json();
  return data.results[0].resourceName;
}

export async function createCampaign(
  accessToken: string,
  customerId: string,
  campaignName: string,
  budgetResourceName: string,
  hasDSA: boolean,
  domainUrl?: string,
  languageCode?: string,
): Promise<string> {
  const campaignBody: Record<string, unknown> = {
    name: campaignName,
    status: "PAUSED",
    advertisingChannelType: "SEARCH",
    campaignBudget: budgetResourceName,
    manualCpc: {},
    networkSettings: {
      targetGoogleSearch: true,
      targetSearchNetwork: false,
      targetContentNetwork: false,
      targetPartnerSearchNetwork: false,
    },
    containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
  };

  if (hasDSA && domainUrl) {
    try {
      const domain = new URL(domainUrl).hostname.replace(/^www\./, "");
      campaignBody.dynamicSearchAdsSetting = {
        domainName: domain,
        languageCode: languageCode || "en",
      };
    } catch {
      // skip if URL parsing fails
    }
  }

  const res = await fetch(
    `${BASE_URL}/customers/${customerId}/campaigns:mutate`,
    {
      method: "POST",
      headers: apiHeaders(accessToken),
      body: JSON.stringify({ operations: [{ create: campaignBody }] }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Campaign creation failed: ${text}`);
  }
  const data = await res.json();
  return data.results[0].resourceName;
}

// Google Ads language criterion IDs: https://developers.google.com/google-ads/api/reference/data/codes-formats#languages
const LANGUAGE_CRITERION_IDS: Record<string, string> = {
  en: "1000", ar: "1019", bg: "1020", ca: "1038", zh: "1017", hr: "1039",
  cs: "1021", da: "1009", nl: "1010", et: "1043", fil: "1042", fi: "1011",
  fr: "1002", de: "1001", el: "1022", he: "1027", hi: "1023", hu: "1024",
  id: "1025", it: "1004", ja: "1005", ko: "1012", lv: "1028", lt: "1029",
  ms: "1102", no: "1013", pl: "1030", pt: "1014", ro: "1032", ru: "1031",
  sr: "1035", sk: "1033", sl: "1034", es: "1003", sv: "1015", th: "1044",
  tr: "1037", uk: "1036", vi: "1040",
};

export async function setCampaignLanguageTarget(
  accessToken: string,
  customerId: string,
  campaignResourceName: string,
  languageCode: string,
): Promise<void> {
  const criterionId = LANGUAGE_CRITERION_IDS[languageCode];
  if (!criterionId) return; // Unknown language, skip targeting (defaults to all)

  const res = await fetch(
    `${BASE_URL}/customers/${customerId}/campaignCriteria:mutate`,
    {
      method: "POST",
      headers: apiHeaders(accessToken),
      body: JSON.stringify({
        operations: [
          {
            create: {
              campaign: campaignResourceName,
              language: {
                languageConstant: `languageConstants/${criterionId}`,
              },
            },
          },
        ],
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    console.warn(`Language targeting failed for ${languageCode}: ${text}`);
  }
}

export async function createAdGroup(
  accessToken: string,
  customerId: string,
  campaignResourceName: string,
  adGroupName: string,
  isDSA: boolean,
): Promise<string> {
  const res = await fetch(
    `${BASE_URL}/customers/${customerId}/adGroups:mutate`,
    {
      method: "POST",
      headers: apiHeaders(accessToken),
      body: JSON.stringify({
        operations: [
          {
            create: {
              campaign: campaignResourceName,
              name: adGroupName,
              status: "ENABLED",
              type: isDSA ? "SEARCH_DYNAMIC_ADS" : "SEARCH_STANDARD",
              cpcBidMicros: "1000000",
            },
          },
        ],
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ad group creation failed: ${text}`);
  }
  const data = await res.json();
  return data.results[0].resourceName;
}

export async function addKeywords(
  accessToken: string,
  customerId: string,
  adGroupResourceName: string,
  keywords: string[],
): Promise<void> {
  if (keywords.length === 0) return;
  const operations = keywords.map((kw) => ({
    create: {
      adGroup: adGroupResourceName,
      status: "ENABLED",
      keyword: {
        text: kw.replace(/[\[\]"]/g, ""),
        matchType: "PHRASE",
      },
    },
  }));
  const res = await fetch(
    `${BASE_URL}/customers/${customerId}/adGroupCriteria:mutate`,
    {
      method: "POST",
      headers: apiHeaders(accessToken),
      body: JSON.stringify({ operations }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Keywords creation failed: ${text}`);
  }
}

export async function addWebpageCriterion(
  accessToken: string,
  customerId: string,
  adGroupResourceName: string,
  targetUrl: string,
): Promise<void> {
  // Extract the folder path (e.g. "/bedrooms/") so DSA targets all pages in that section
  let urlPath = "/";
  try {
    const parsed = new URL(targetUrl);
    const segments = parsed.pathname.split("/").filter((s) => s.length > 0);
    // Use the first subfolder segment if available
    if (segments.length > 0) {
      urlPath = "/" + segments[0] + "/";
    }
  } catch {
    // fallback to full URL
  }

  const res = await fetch(
    `${BASE_URL}/customers/${customerId}/adGroupCriteria:mutate`,
    {
      method: "POST",
      headers: apiHeaders(accessToken),
      body: JSON.stringify({
        operations: [
          {
            create: {
              adGroup: adGroupResourceName,
              status: "ENABLED",
              webpage: {
                criterionName: "Target: " + urlPath,
                conditions: [
                  {
                    operand: "URL",
                    argument: urlPath,
                  },
                ],
              },
            },
          },
        ],
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Webpage criterion creation failed: ${text}`);
  }
}

export async function createResponsiveSearchAd(
  accessToken: string,
  customerId: string,
  adGroupResourceName: string,
  headlines: string[],
  descriptions: string[],
  finalUrl: string,
  path1?: string,
  path2?: string,
): Promise<void> {
  const safeHeadlines = headlines
    .slice(0, 15)
    .filter((h) => h.length <= 30 && h.length > 0);
  const safeDescriptions = descriptions
    .slice(0, 4)
    .filter((d) => d.length <= 90 && d.length > 0);

  if (safeHeadlines.length < 3 || safeDescriptions.length < 2) {
    throw new Error(
      `RSA requires >=3 headlines (<=30 chars) and >=2 descriptions (<=90 chars). Got ${safeHeadlines.length} headlines, ${safeDescriptions.length} descriptions. Run "Fix Compliance" first.`,
    );
  }

  const rsaBody: Record<string, unknown> = {
    headlines: safeHeadlines.map((text) => ({ text })),
    descriptions: safeDescriptions.map((text) => ({ text })),
  };

  if (path1) rsaBody.path1 = path1.substring(0, 15);
  if (path2) rsaBody.path2 = path2.substring(0, 15);

  const res = await fetch(
    `${BASE_URL}/customers/${customerId}/adGroupAds:mutate`,
    {
      method: "POST",
      headers: apiHeaders(accessToken),
      body: JSON.stringify({
        operations: [
          {
            create: {
              adGroup: adGroupResourceName,
              status: "ENABLED",
              ad: {
                finalUrls: [finalUrl],
                responsiveSearchAd: rsaBody,
              },
            },
          },
        ],
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RSA creation failed: ${text}`);
  }
}

export async function createExpandedDynamicSearchAd(
  accessToken: string,
  customerId: string,
  adGroupResourceName: string,
  descriptions: string[],
): Promise<void> {
  const safeDescriptions = descriptions.filter(
    (d) => d.length <= 90 && d.length > 0,
  );
  if (safeDescriptions.length === 0) {
    throw new Error("DSA requires at least 1 description under 90 chars");
  }

  const dsaBody: Record<string, unknown> = {
    description: safeDescriptions[0],
  };
  if (safeDescriptions[1]) {
    dsaBody.description2 = safeDescriptions[1];
  }

  const res = await fetch(
    `${BASE_URL}/customers/${customerId}/adGroupAds:mutate`,
    {
      method: "POST",
      headers: apiHeaders(accessToken),
      body: JSON.stringify({
        operations: [
          {
            create: {
              adGroup: adGroupResourceName,
              status: "ENABLED",
              ad: {
                expandedDynamicSearchAd: dsaBody,
              },
            },
          },
        ],
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DSA ad creation failed: ${text}`);
  }
}

export async function addSitelinks(
  accessToken: string,
  customerId: string,
  adGroupResourceName: string,
  sitelinks: { linkText: string; description1: string; description2: string; finalUrl: string }[],
): Promise<void> {
  if (sitelinks.length === 0) return;

  // Create sitelink assets
  const assetOps = sitelinks.map((sl) => ({
    create: {
      sitelinkAsset: {
        linkText: sl.linkText.slice(0, 25),
        description1: sl.description1.slice(0, 35),
        description2: sl.description2.slice(0, 35),
      },
      finalUrls: [sl.finalUrl],
    },
  }));

  const assetRes = await fetch(
    `${BASE_URL}/customers/${customerId}/assets:mutate`,
    {
      method: "POST",
      headers: apiHeaders(accessToken),
      body: JSON.stringify({ operations: assetOps }),
    },
  );
  if (!assetRes.ok) {
    const text = await assetRes.text();
    console.warn(`Sitelink asset creation failed: ${text}`);
    return;
  }
  const assetData = await assetRes.json();
  const assetResourceNames: string[] = (assetData.results || []).map(
    (r: any) => r.resourceName,
  );

  // Link assets to ad group
  const linkOps = assetResourceNames.map((resourceName) => ({
    create: {
      adGroup: adGroupResourceName,
      asset: resourceName,
      fieldType: "SITELINK",
    },
  }));

  const linkRes = await fetch(
    `${BASE_URL}/customers/${customerId}/adGroupAssets:mutate`,
    {
      method: "POST",
      headers: apiHeaders(accessToken),
      body: JSON.stringify({ operations: linkOps }),
    },
  );
  if (!linkRes.ok) {
    const text = await linkRes.text();
    console.warn(`Sitelink ad group link failed: ${text}`);
  }
}

export async function addCallouts(
  accessToken: string,
  customerId: string,
  adGroupResourceName: string,
  callouts: string[],
): Promise<void> {
  if (callouts.length === 0) return;

  // Create callout assets
  const assetOps = callouts.map((text) => ({
    create: {
      calloutAsset: {
        calloutText: text.slice(0, 25),
      },
    },
  }));

  const assetRes = await fetch(
    `${BASE_URL}/customers/${customerId}/assets:mutate`,
    {
      method: "POST",
      headers: apiHeaders(accessToken),
      body: JSON.stringify({ operations: assetOps }),
    },
  );
  if (!assetRes.ok) {
    const text = await assetRes.text();
    console.warn(`Callout asset creation failed: ${text}`);
    return;
  }
  const assetData = await assetRes.json();
  const assetResourceNames: string[] = (assetData.results || []).map(
    (r: any) => r.resourceName,
  );

  // Link assets to ad group
  const linkOps = assetResourceNames.map((resourceName) => ({
    create: {
      adGroup: adGroupResourceName,
      asset: resourceName,
      fieldType: "CALLOUT",
    },
  }));

  const linkRes = await fetch(
    `${BASE_URL}/customers/${customerId}/adGroupAssets:mutate`,
    {
      method: "POST",
      headers: apiHeaders(accessToken),
      body: JSON.stringify({ operations: linkOps }),
    },
  );
  if (!linkRes.ok) {
    const text = await linkRes.text();
    console.warn(`Callout ad group link failed: ${text}`);
  }
}

const DATE_RANGE_MAP: Record<number, string> = {
  7: "LAST_7_DAYS",
  14: "LAST_14_DAYS",
  30: "LAST_30_DAYS",
};

export async function fetchSearchTermReport(
  accessToken: string,
  customerId: string,
  days: number = 30,
  conversionsOnly: boolean = true,
): Promise<SearchTermResult[]> {
  const dateRange = DATE_RANGE_MAP[days] || "LAST_30_DAYS";
  const convFilter = conversionsOnly ? "\n  AND metrics.conversions > 0" : "";

  const query = `SELECT
  search_term_view.search_term,
  campaign.name,
  ad_group.name,
  metrics.clicks,
  metrics.impressions,
  metrics.conversions,
  metrics.conversions_value,
  metrics.cost_micros
FROM search_term_view
WHERE segments.date DURING ${dateRange}${convFilter}
ORDER BY metrics.conversions_value DESC`;

  const results: SearchTermResult[] = [];
  let pageToken: string | undefined;

  do {
    const body: Record<string, unknown> = { query };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch(
      `${BASE_URL}/customers/${customerId}/googleAds:search`,
      {
        method: "POST",
        headers: apiHeaders(accessToken),
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Search term report failed: ${text}`);
    }

    const data = await res.json();

    for (const row of data.results || []) {
      results.push({
        searchTerm: row.searchTermView?.searchTerm || "",
        campaign: row.campaign?.name || "",
        adGroup: row.adGroup?.name || "",
        clicks: Number(row.metrics?.clicks || 0),
        impressions: Number(row.metrics?.impressions || 0),
        conversions: Number(row.metrics?.conversions || 0),
        conversionValue: Number(row.metrics?.conversionsValue || 0),
        cost: Number(row.metrics?.costMicros || 0) / 1_000_000,
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return results;
}

// --- Sync: fetch campaign structure from Google Ads ---

export interface SyncedAdGroup {
  resourceName: string;
  name: string;
  status: string;
  type: string;
  keywords: { text: string; matchType: string }[];
  headlines: string[];
  descriptions: string[];
  finalUrl: string;
}

export interface SyncedCampaign {
  resourceName: string;
  name: string;
  status: string;
  adGroups: SyncedAdGroup[];
}

async function gaqlSearch(
  accessToken: string,
  customerId: string,
  query: string,
): Promise<any[]> {
  const allRows: any[] = [];
  let pageToken: string | undefined;

  do {
    const body: Record<string, unknown> = { query };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch(
      `${BASE_URL}/customers/${customerId}/googleAds:search`,
      {
        method: "POST",
        headers: apiHeaders(accessToken),
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GAQL search failed: ${text}`);
    }
    const data = await res.json();
    if (data.results) allRows.push(...data.results);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allRows;
}

export async function fetchCampaignsFromAds(
  accessToken: string,
  customerId: string,
  campaignResourceNames: string[],
): Promise<SyncedCampaign[]> {
  if (campaignResourceNames.length === 0) return [];

  const inClause = campaignResourceNames.map((r) => `'${r}'`).join(", ");

  // Query 1: campaigns + ad groups + ads (headlines/descriptions/finalUrls)
  const adsQuery = `
    SELECT
      campaign.resource_name,
      campaign.name,
      campaign.status,
      ad_group.resource_name,
      ad_group.name,
      ad_group.status,
      ad_group.type,
      ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.ad.responsive_search_ad.descriptions,
      ad_group_ad.ad.final_urls,
      ad_group_ad.status
    FROM ad_group_ad
    WHERE campaign.resource_name IN (${inClause})
      AND ad_group_ad.status != 'REMOVED'
  `;

  // Query 2: keywords
  const kwQuery = `
    SELECT
      campaign.resource_name,
      ad_group.resource_name,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.status
    FROM ad_group_criterion
    WHERE campaign.resource_name IN (${inClause})
      AND ad_group_criterion.type = 'KEYWORD'
      AND ad_group_criterion.status != 'REMOVED'
  `;

  const [adsRows, kwRows] = await Promise.all([
    gaqlSearch(accessToken, customerId, adsQuery),
    gaqlSearch(accessToken, customerId, kwQuery),
  ]);

  // Build campaign map
  const campaignMap = new Map<string, SyncedCampaign>();
  const adGroupMap = new Map<string, SyncedAdGroup>();

  for (const row of adsRows) {
    const campRes = row.campaign?.resourceName;
    const campName = row.campaign?.name;
    const campStatus = row.campaign?.status;

    if (!campaignMap.has(campRes)) {
      campaignMap.set(campRes, {
        resourceName: campRes,
        name: campName,
        status: campStatus,
        adGroups: [],
      });
    }

    const agRes = row.adGroup?.resourceName;
    if (agRes && !adGroupMap.has(agRes)) {
      const ag: SyncedAdGroup = {
        resourceName: agRes,
        name: row.adGroup.name,
        status: row.adGroup.status,
        type: row.adGroup.type,
        keywords: [],
        headlines: [],
        descriptions: [],
        finalUrl: "",
      };
      adGroupMap.set(agRes, ag);
      campaignMap.get(campRes)!.adGroups.push(ag);
    }

    // Extract RSA headlines/descriptions
    const rsa = row.adGroupAd?.ad?.responsiveSearchAd;
    if (rsa && agRes) {
      const ag = adGroupMap.get(agRes)!;
      if (rsa.headlines?.length > 0) {
        ag.headlines = rsa.headlines.map((h: any) => h.text);
      }
      if (rsa.descriptions?.length > 0) {
        ag.descriptions = rsa.descriptions.map((d: any) => d.text);
      }
    }

    const finalUrls = row.adGroupAd?.ad?.finalUrls;
    if (finalUrls?.length > 0 && agRes) {
      adGroupMap.get(agRes)!.finalUrl = finalUrls[0];
    }
  }

  // Merge keywords
  for (const row of kwRows) {
    const agRes = row.adGroup?.resourceName;
    const ag = adGroupMap.get(agRes);
    if (ag && row.adGroupCriterion?.keyword) {
      ag.keywords.push({
        text: row.adGroupCriterion.keyword.text,
        matchType: row.adGroupCriterion.keyword.matchType,
      });
    }
  }

  return Array.from(campaignMap.values());
}
