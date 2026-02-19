const OAUTH_AUTHORIZE_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const OAUTH_TOKEN_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const BING_API_URL =
  "https://campaign.api.bingads.microsoft.com/Api/Advertiser/CampaignManagement/v13";
const CUSTOMER_API_URL =
  "https://clientcenter.api.bingads.microsoft.com/Api/CustomerManagement/v13";

export function getAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_ADS_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "https://ads.microsoft.com/msads.manage offline_access",
    state,
    prompt: "select_account",
  });
  return `${OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_ADS_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_ADS_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      scope: "https://ads.microsoft.com/msads.manage offline_access",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft token exchange failed: ${text}`);
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_ADS_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_ADS_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: "https://ads.microsoft.com/msads.manage offline_access",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft token refresh failed: ${text}`);
  }
  return res.json();
}

function soapEnvelope(
  service: string,
  action: string,
  body: string,
  accessToken: string,
): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Header>
    <h:ApplicationToken xmlns:h="https://bingads.microsoft.com/${service}/v13" />
    <h:AuthenticationToken xmlns:h="https://bingads.microsoft.com/${service}/v13">${accessToken}</h:AuthenticationToken>
    <h:DeveloperToken xmlns:h="https://bingads.microsoft.com/${service}/v13">${process.env.MICROSOFT_ADS_DEVELOPER_TOKEN!}</h:DeveloperToken>
  </s:Header>
  <s:Body>${body}</s:Body>
</s:Envelope>`;
}

async function soapRequest(
  url: string,
  service: string,
  action: string,
  body: string,
  accessToken: string,
): Promise<string> {
  const envelope = soapEnvelope(service, action, body, accessToken);
  console.log(`[MS Ads SOAP] ${action} request to ${url}`);
  console.log(`[MS Ads SOAP] Access token: ${accessToken.slice(0, 20)}...`);
  console.log(
    `[MS Ads SOAP] Developer token: ${process.env.MICROSOFT_ADS_DEVELOPER_TOKEN?.slice(0, 10)}...`,
  );

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: action,
    },
    body: envelope,
  });
  const text = await res.text();
  console.log(`[MS Ads SOAP] ${action} response status: ${res.status}`);

  if (!res.ok) {
    console.error(
      `[MS Ads SOAP] ${action} error response:`,
      text.slice(0, 2000),
    );
    throw new Error(
      `Microsoft Ads API error (${action}) [${res.status} ${res.statusText}]: ${text.slice(0, 1000) || "(empty response)"}`,
    );
  }
  return text;
}

function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<[^:]*:?${tag}[^>]*>([^<]*)<`, "i");
  const match = xml.match(regex);
  return match ? match[1] : "";
}

function extractAllTags(xml: string, tag: string): string[] {
  const regex = new RegExp(`<[^:]*:?${tag}[^>]*>([^<]*)<`, "gi");
  const results: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1]);
  }
  return results;
}

export interface MsAdsAccount {
  id: string;
  name: string;
  customerId: string;
}

export async function getAccounts(
  accessToken: string,
): Promise<MsAdsAccount[]> {
  // Get user info — contains CustomerId for the user's direct account
  const userBody = `<GetUserRequest xmlns="https://bingads.microsoft.com/Customer/v13" />`;
  const userXml = await soapRequest(
    CUSTOMER_API_URL,
    "Customer",
    "GetUser",
    userBody,
    accessToken,
  );

  // Extract the user's customer IDs from the response
  const customerIds = extractAllTags(userXml, "CustomerId");
  const userId = extractTag(userXml, "Id");

  if (customerIds.length === 0 && !userId) {
    throw new Error("Could not retrieve user information from Microsoft Ads");
  }

  // Use GetAccountsInfo to get accounts for the customer
  // This works for direct accounts (not just managers)
  const customerId = customerIds[0] || extractTag(userXml, "CustomerId");

  const accountsInfoBody = `<GetAccountsInfoRequest xmlns="https://bingads.microsoft.com/Customer/v13">
    <CustomerId>${customerId}</CustomerId>
    <OnlyParentAccounts>false</OnlyParentAccounts>
  </GetAccountsInfoRequest>`;

  try {
    const accountsXml = await soapRequest(
      CUSTOMER_API_URL,
      "Customer",
      "GetAccountsInfo",
      accountsInfoBody,
      accessToken,
    );

    // Parse AccountInfo elements
    const accountBlocks = accountsXml
      .split(/<(?:[^:]*:)?AccountInfo/gi)
      .slice(1);
    const accounts: MsAdsAccount[] = [];

    for (const block of accountBlocks) {
      const id = extractTag(block, "Id");
      const name =
        extractTag(block, "Name") || extractTag(block, "AccountName");
      if (id) {
        accounts.push({ id, name: name || `Account ${id}`, customerId });
      }
    }

    if (accounts.length > 0) return accounts;
  } catch {
    // Fall through to SearchAccounts
  }

  // Fallback: try SearchAccounts
  const searchBody = `<SearchAccountsRequest xmlns="https://bingads.microsoft.com/Customer/v13">
    <Predicates>
      <Predicate>
        <Field>UserId</Field>
        <Operator>Equals</Operator>
        <Value>${userId}</Value>
      </Predicate>
    </Predicates>
    <Ordering />
    <PageInfo>
      <Index>0</Index>
      <Size>100</Size>
    </PageInfo>
  </SearchAccountsRequest>`;

  try {
    const accountsXml = await soapRequest(
      CUSTOMER_API_URL,
      "Customer",
      "SearchAccounts",
      searchBody,
      accessToken,
    );

    const accountBlocks = accountsXml
      .split(/<(?:[^:]*:)?AdvertiserAccount/gi)
      .slice(1);
    const accounts: MsAdsAccount[] = [];

    for (const block of accountBlocks) {
      const id = extractTag(block, "Id");
      const name = extractTag(block, "Name");
      const custId = extractTag(block, "ParentCustomerId") || customerId;
      if (id && name) {
        accounts.push({ id, name, customerId: custId });
      }
    }

    return accounts;
  } catch {
    // Last resort — return the customer ID as the account
    return [{ id: customerId, name: `Account ${customerId}`, customerId }];
  }
}

export interface AddKeywordResult {
  success: boolean;
  keywordId?: string;
  error?: string;
}

export async function addKeywordsToAdGroup(
  accessToken: string,
  accountId: string,
  customerId: string,
  adGroupId: string,
  keywords: { text: string; matchType: string; bid: number }[],
): Promise<AddKeywordResult[]> {
  const keywordXml = keywords
    .map(
      (
        kw,
      ) => `<Keyword xmlns:e="https://bingads.microsoft.com/CampaignManagement/v13">
        <e:Bid>
          <e:Amount>${kw.bid.toFixed(2)}</e:Amount>
        </e:Bid>
        <e:MatchType>${kw.matchType}</e:MatchType>
        <e:Status>Active</e:Status>
        <e:Text>${escapeXml(kw.text)}</e:Text>
      </Keyword>`,
    )
    .join("\n");

  const body = `<AddKeywordsRequest xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
    <AdGroupId>${adGroupId}</AdGroupId>
    <Keywords>${keywordXml}</Keywords>
  </AddKeywordsRequest>`;

  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Header>
    <h:ApplicationToken xmlns:h="https://bingads.microsoft.com/CampaignManagement/v13" />
    <h:AuthenticationToken xmlns:h="https://bingads.microsoft.com/CampaignManagement/v13">${accessToken}</h:AuthenticationToken>
    <h:CustomerAccountId xmlns:h="https://bingads.microsoft.com/CampaignManagement/v13">${accountId}</h:CustomerAccountId>
    <h:CustomerId xmlns:h="https://bingads.microsoft.com/CampaignManagement/v13">${customerId}</h:CustomerId>
    <h:DeveloperToken xmlns:h="https://bingads.microsoft.com/CampaignManagement/v13">${process.env.MICROSOFT_ADS_DEVELOPER_TOKEN!}</h:DeveloperToken>
  </s:Header>
  <s:Body>${body}</s:Body>
</s:Envelope>`;

  const res = await fetch(BING_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "AddKeywords",
    },
    body: envelope,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`AddKeywords failed: ${text.slice(0, 500)}`);
  }

  const ids = extractAllTags(text, "long");
  return keywords.map((_, i) => ({
    success: !!ids[i] && ids[i] !== "0",
    keywordId: ids[i] || undefined,
  }));
}

export async function getCampaigns(
  accessToken: string,
  accountId: string,
  customerId: string,
): Promise<{ id: string; name: string }[]> {
  const body = `<GetCampaignsByAccountIdRequest xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
    <AccountId>${accountId}</AccountId>
    <CampaignType>Search</CampaignType>
    <ReturnAdditionalFields>None</ReturnAdditionalFields>
  </GetCampaignsByAccountIdRequest>`;

  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Header>
    <h:ApplicationToken xmlns:h="https://bingads.microsoft.com/CampaignManagement/v13" />
    <h:AuthenticationToken xmlns:h="https://bingads.microsoft.com/CampaignManagement/v13">${accessToken}</h:AuthenticationToken>
    <h:CustomerAccountId xmlns:h="https://bingads.microsoft.com/CampaignManagement/v13">${accountId}</h:CustomerAccountId>
    <h:CustomerId xmlns:h="https://bingads.microsoft.com/CampaignManagement/v13">${customerId}</h:CustomerId>
    <h:DeveloperToken xmlns:h="https://bingads.microsoft.com/CampaignManagement/v13">${process.env.MICROSOFT_ADS_DEVELOPER_TOKEN!}</h:DeveloperToken>
  </s:Header>
  <s:Body>${body}</s:Body>
</s:Envelope>`;

  const res = await fetch(BING_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "GetCampaignsByAccountId",
    },
    body: envelope,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GetCampaigns failed: ${text.slice(0, 500)}`);
  }

  const blocks = text.split(/<(?:[^:]*:)?Campaign(?:\s|>)/gi).slice(1);
  const campaigns: { id: string; name: string }[] = [];
  for (const block of blocks) {
    const id = extractTag(block, "Id");
    const name = extractTag(block, "Name");
    if (id && name) campaigns.push({ id, name });
  }
  return campaigns;
}

export async function getAdGroupsByCampaignId(
  accessToken: string,
  accountId: string,
  customerId: string,
  campaignId: string,
): Promise<{ id: string; name: string }[]> {
  const body = `<GetAdGroupsByCampaignIdRequest xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
    <CampaignId>${campaignId}</CampaignId>
  </GetAdGroupsByCampaignIdRequest>`;

  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Header>
    <h:ApplicationToken xmlns:h="https://bingads.microsoft.com/CampaignManagement/v13" />
    <h:AuthenticationToken xmlns:h="https://bingads.microsoft.com/CampaignManagement/v13">${accessToken}</h:AuthenticationToken>
    <h:CustomerAccountId xmlns:h="https://bingads.microsoft.com/CampaignManagement/v13">${accountId}</h:CustomerAccountId>
    <h:CustomerId xmlns:h="https://bingads.microsoft.com/CampaignManagement/v13">${customerId}</h:CustomerId>
    <h:DeveloperToken xmlns:h="https://bingads.microsoft.com/CampaignManagement/v13">${process.env.MICROSOFT_ADS_DEVELOPER_TOKEN!}</h:DeveloperToken>
  </s:Header>
  <s:Body>${body}</s:Body>
</s:Envelope>`;

  const res = await fetch(BING_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "GetAdGroupsByCampaignId",
    },
    body: envelope,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GetAdGroups failed: ${text.slice(0, 500)}`);
  }

  const blocks = text.split(/<(?:[^:]*:)?AdGroup(?:\s|>)/gi).slice(1);
  const adGroups: { id: string; name: string }[] = [];
  for (const block of blocks) {
    const id = extractTag(block, "Id");
    const name = extractTag(block, "Name");
    if (id && name) adGroups.push({ id, name });
  }
  return adGroups;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
