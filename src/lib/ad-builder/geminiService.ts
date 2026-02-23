import { AIConfig } from "./aiConfig";
import { FolderNode, Campaign, AdGroup, AIDebugInfo } from "./types";

const PROXIES = [
  "https://api.allorigins.win/raw?url=",
  "https://corsproxy.io/?",
  "https://api.codetabs.com/v1/proxy?quest=",
];

async function fetchWithTimeout(
  resource: string,
  options: RequestInit = {},
  timeout = 5000,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function fetchUrlContent(targetUrl: string): Promise<string | null> {
  for (const proxy of PROXIES) {
    try {
      const response = await fetchWithTimeout(
        proxy + encodeURIComponent(targetUrl),
        {},
        6000,
      );
      if (response.ok) {
        const text = await response.text();
        if (text && text.length > 50) return text;
      }
    } catch {
      // Silently fail over to next proxy
    }
  }
  return null;
}

interface ExtractedData {
  title: string;
  metaDesc: string;
  h1: string;
  h2: string;
  content: string;
}

async function extractPageData(url: string): Promise<ExtractedData> {
  const html = await fetchUrlContent(url);

  if (!html) {
    return { title: "", metaDesc: "", h1: "", h2: "", content: "" };
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const scripts = doc.querySelectorAll(
      "script, style, noscript, iframe, svg, nav, footer, header",
    );
    scripts.forEach((s) => s.remove());

    const title = doc.title.trim();
    const metaDesc =
      doc
        .querySelector('meta[name="description"]')
        ?.getAttribute("content")
        ?.trim() || "";

    const h1 = Array.from(doc.querySelectorAll("h1"))
      .map((h) => h.textContent?.trim())
      .filter(Boolean)
      .join(" | ");
    const h2 = Array.from(doc.querySelectorAll("h2"))
      .slice(0, 8)
      .map((h) => h.textContent?.trim())
      .filter(Boolean)
      .join(" | ");

    const paragraphs = Array.from(doc.querySelectorAll("p, li"))
      .map((p) => p.textContent?.trim() || "")
      .filter((t) => t.length > 40)
      .slice(0, 8)
      .join("\n");

    return { title, metaDesc, h1, h2, content: paragraphs };
  } catch {
    return { title: "", metaDesc: "", h1: "", h2: "", content: "" };
  }
}

function parseSitemapRaw(xmlContent: string): {
  urls: string[];
  sitemaps: string[];
} {
  const urls: string[] = [];
  const sitemaps: string[] = [];

  const sitemapRegex = /<sitemap>[\s\S]*?<loc>(.*?)<\/loc>[\s\S]*?<\/sitemap>/g;
  let sitemapMatch;
  while ((sitemapMatch = sitemapRegex.exec(xmlContent)) !== null) {
    if (sitemapMatch[1]) sitemaps.push(sitemapMatch[1].trim());
  }

  const urlRegex = /<url>[\s\S]*?<loc>(.*?)<\/loc>[\s\S]*?<\/url>/g;
  let urlMatch;
  while ((urlMatch = urlRegex.exec(xmlContent)) !== null) {
    if (urlMatch[1]) urls.push(urlMatch[1].trim());
  }

  if (urls.length === 0 && sitemaps.length === 0) {
    const locRegex = /<loc>(.*?)<\/loc>/g;
    let locMatch;
    while ((locMatch = locRegex.exec(xmlContent)) !== null) {
      const loc = locMatch[1].trim();
      if (loc.match(/(\.xml|\.xml\.gz)$/i)) {
        sitemaps.push(loc);
      } else {
        urls.push(loc);
      }
    }
  }

  return { urls, sitemaps };
}

async function crawlSitemaps(
  startUrl: string,
  maxDepth = 2,
  currentDepth = 0,
): Promise<string[]> {
  const content = await fetchUrlContent(startUrl);
  if (!content) return [];

  const { urls, sitemaps } = parseSitemapRaw(content);
  let allUrls = [...urls];

  if (sitemaps.length > 0 && currentDepth < maxDepth) {
    for (const subSitemap of sitemaps) {
      const childUrls = await crawlSitemaps(
        subSitemap,
        maxDepth,
        currentDepth + 1,
      );
      allUrls.push(...childUrls);
    }
  }
  return allUrls;
}

export const fetchRawUrls = async (
  url: string,
  sitemapUrl?: string,
): Promise<string[]> => {
  let candidates: string[] = [];
  const baseUrl = url.replace(/\/$/, "");

  if (sitemapUrl) {
    candidates.push(sitemapUrl);
  } else {
    candidates.push(`${baseUrl}/sitemap_index.xml`);
    candidates.push(`${baseUrl}/sitemap.xml`);
    candidates.push(`${baseUrl}/wp-sitemap.xml`);

    try {
      const robotsTxt = await fetchUrlContent(`${baseUrl}/robots.txt`);
      if (robotsTxt) {
        const match = robotsTxt.match(/Sitemap:\s*(https?:\/\/[^\s]+)/i);
        if (match && match[1]) candidates.unshift(match[1]);
      }
    } catch {
      // ignore
    }
  }

  candidates = [...new Set(candidates)];
  let foundUrls: string[] = [];

  for (const candidate of candidates) {
    const discoveredUrls = await crawlSitemaps(candidate);
    const validUrls = discoveredUrls.filter(
      (u) =>
        u.startsWith("http") && !u.match(/\.(jpg|jpeg|png|gif|webp|pdf)$/i),
    );
    if (validUrls.length > 0) foundUrls.push(...validUrls);
  }

  foundUrls = [...new Set(foundUrls)];

  if (foundUrls.length === 0) {
    throw new Error(
      "No URLs found via sitemap. Try pasting URLs manually in 'Fast Options'.",
    );
  }

  return foundUrls;
};

const GEMINI_THINKING_MODELS = ["gemini-2.5", "gemini-3"];

function isGeminiThinkingModel(model: string): boolean {
  return GEMINI_THINKING_MODELS.some((prefix) => model.startsWith(prefix));
}

async function callAI(
  config: AIConfig,
  prompt: string,
  timeoutMs = 60000,
): Promise<any> {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(`Request Timed Out (${timeoutMs}ms)`)),
      timeoutMs,
    ),
  );

  const url = config.baseUrl.replace(/\/$/, "") + "/chat/completions";

  // Gemini 2.5+ thinking models: disable thinking for reliable JSON output
  const isThinking = isGeminiThinkingModel(config.model);
  const body: Record<string, unknown> = {
    model: config.model,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.1,
  };
  if (isThinking) {
    body.reasoning_effort = "none";
  }

  const apiCall = fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  }).then(async (res) => {
    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      throw new Error(
        `API Error ${res.status}: ${errorBody || res.statusText}`,
      );
    }
    return res.json();
  });

  const response: any = await Promise.race([apiCall, timeoutPromise]);

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from AI provider");
  }

  let jsonText = content
    .replace(/^```json\s*/, "")
    .replace(/^```\s*/, "")
    .replace(/\s*```$/, "");
  return JSON.parse(jsonText);
}

function cleanAdCopy(text: string, limit: number): string {
  let clean = text.trim();
  if (clean.endsWith(".")) {
    if (limit <= 30 || clean.length > limit) {
      clean = clean.slice(0, -1);
    }
  }
  return clean;
}

async function generateAdGroupForPage(
  config: AIConfig,
  targetUrl: string,
  slug: string,
  campaignObjective: string | undefined,
  onUpdate?: (info: Partial<AIDebugInfo> & { fullPrompt?: string }) => void,
): Promise<{ adGroup: AdGroup; objective: string }> {
  if (onUpdate)
    onUpdate({
      step: "FETCHING_PAGE",
      targetUrl,
      model: config.model,
      timestamp: Date.now(),
    });

  let pageData: ExtractedData = {
    title: "",
    metaDesc: "",
    h1: "",
    h2: "",
    content: "",
  };
  try {
    pageData = await extractPageData(targetUrl);
    if (onUpdate)
      onUpdate({
        extractedContentSnippet: `${pageData.title}\n${pageData.h1}\n${pageData.content.slice(0, 200)}...`,
      });
  } catch {
    // ignore
  }

  const fallbackInfo = `URL: ${targetUrl}\nTopic: ${slug}`;
  const STEP_TIMEOUT_MS = 60000;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const isLiteMode = attempt > 1;

    try {
      const context = isLiteMode
        ? `[LITE MODE] URL: ${targetUrl}, Title: ${pageData.title}, Desc: ${pageData.metaDesc}`
        : `URL: ${targetUrl}\nTitle: ${pageData.title}\nH1: ${pageData.h1}\nContent: ${pageData.content || fallbackInfo}`;

      const locationRule = config.ignoreLocations
        ? `\nIMPORTANT: Do NOT include any city names, region names, or geographic locations in keywords. Ignore any location references that appear in the page content (they are likely from geo-targeting, not the actual service).`
        : "";

      const keywordPrompt = `You are a Google Ads Strategist.
Page Context: ${context}
${locationRule}
Task:
1. Define a campaign objective (e.g. Leads, Sales) - if not obvious, assume Leads.
2. Name the Ad Group based on the URL slug "${slug}".
3. Extract 8-12 high-intent keywords for this page.

Respond with JSON in this exact format:
{
  "objective": "Leads",
  "adGroupName": "Example Name",
  "keywords": ["keyword 1", "keyword 2", "..."]
}`;

      if (onUpdate)
        onUpdate({
          step: "GENERATING_KEYWORDS",
          promptSnippet: keywordPrompt.slice(0, 300),
          timestamp: Date.now(),
        });

      const step1Result = await callAI(config, keywordPrompt, STEP_TIMEOUT_MS);

      const adLocationRule = config.ignoreLocations
        ? `\n- Do NOT include any city names, region names, or geographic locations in headlines or descriptions.`
        : "";

      const creativePrompt = `You are a Google Ads Copywriter.
Context: ${context}
Keywords: ${step1Result.keywords.join(", ")}

Task: Write Responsive Search Ad (RSA) copy.

STRICT RULES:
- 5 Headlines: EXACTLY 30 characters or less. NO trailing periods.
- 3 Descriptions: EXACTLY 90 characters or less.
- If a line is too long, the system will reject it. Be concise.${adLocationRule}

Respond with JSON in this exact format:
{
  "headlines": ["Headline 1", "Headline 2", "Headline 3", "Headline 4", "Headline 5"],
  "descriptions": ["Description 1", "Description 2", "Description 3"]
}`;

      if (onUpdate)
        onUpdate({
          step: "GENERATING_ADS",
          promptSnippet: creativePrompt.slice(0, 300),
          fullPrompt: creativePrompt,
          timestamp: Date.now(),
        });

      const step2Result = await callAI(config, creativePrompt, STEP_TIMEOUT_MS);

      const cleanHeadlines = (step2Result.headlines || []).map((h: string) =>
        cleanAdCopy(h, 30),
      );
      const cleanDescriptions = (step2Result.descriptions || []).map(
        (d: string) => cleanAdCopy(d, 90),
      );

      if (onUpdate)
        onUpdate({
          step: "COMPLETE",
          rawResponse: JSON.stringify(
            { ...step1Result, ...step2Result },
            null,
            2,
          ),
          timestamp: Date.now(),
        });

      return {
        objective: step1Result.objective,
        adGroup: {
          id: `ag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: step1Result.adGroupName,
          keywords: step1Result.keywords || [],
          headlines: cleanHeadlines,
          descriptions: cleanDescriptions,
          landingPageUrl: targetUrl,
        },
      };
    } catch (e: any) {
      console.warn(`Attempt ${attempt} failed for ${targetUrl}`, e);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error(`Failed to generate ad group for ${targetUrl}`);
}

export const batchFixAdCopy = async (
  config: AIConfig,
  items: { id: string; text: string; type: "HEADLINE" | "DESCRIPTION" }[],
): Promise<{ id: string; rewrittenText: string }[]> => {
  if (items.length === 0) return [];

  const CHUNK_SIZE = 10;
  const allRepairs: { id: string; rewrittenText: string }[] = [];

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const prompt = `You are a Google Ads Compliance Editor.
I have a list of ad copy strings that are too long. Rewrite them to meet the character limits.

Limits:
- HEADLINE: Max 30 chars. No trailing period.
- DESCRIPTION: Max 90 chars.

Input Items:
${chunk.map((item, idx) => `${idx + 1}. [${item.type}] (ID: ${item.id}) "${item.text}"`).join("\n")}

Respond with JSON in this exact format:
{
  "repairs": [
    { "id": "item-id", "rewrittenText": "shortened text" }
  ]
}`;

    try {
      const result = await callAI(config, prompt, 60000);
      const repairs = result.repairs || [];
      allRepairs.push(...repairs);
    } catch (e) {
      console.error(
        `Compliance batch ${Math.floor(i / CHUNK_SIZE) + 1} failed`,
        e,
      );
    }
  }

  return allRepairs;
};

export const generateSingleCampaign = async (
  config: AIConfig,
  baseUrl: string,
  siteName: string,
  node: FolderNode,
  onUpdate?: (info: Partial<AIDebugInfo> & { fullPrompt?: string }) => void,
): Promise<Campaign> => {
  let origin = baseUrl;
  try {
    const u = new URL(baseUrl);
    origin = u.origin;
  } catch {
    origin = baseUrl.replace(/\/$/, "");
  }

  const targetsMap = new Map<string, FolderNode>();
  targetsMap.set(node.path, node);
  if (node.children) {
    node.children.forEach((child) => {
      targetsMap.set(child.path, child);
    });
  }

  const targets = Array.from(targetsMap.values());
  const generatedAdGroups: AdGroup[] = [];
  let primaryObjective = "Leads";

  for (let i = 0; i < targets.length; i++) {
    const targetNode = targets[i];
    const cleanPath = targetNode.path.startsWith("/")
      ? targetNode.path
      : `/${targetNode.path}`;
    const targetUrl = origin + cleanPath;
    const urlSlug =
      cleanPath.split("/").filter(Boolean).pop() || targetNode.name;

    try {
      const result = await generateAdGroupForPage(
        config,
        targetUrl,
        urlSlug,
        primaryObjective,
        onUpdate,
      );
      generatedAdGroups.push(result.adGroup);
      if (i === 0) primaryObjective = result.objective;
    } catch (e) {
      console.error(`Failed to process ad group for ${targetUrl}`, e);
    }
  }

  if (generatedAdGroups.length === 0) {
    throw new Error(
      `Could not generate any valid Ad Groups for campaign: ${node.name}`,
    );
  }

  try {
    const dsaPrompt = `You are a Google Ads Copywriter.
Campaign: "${node.name}" for ${siteName}
Campaign objective: ${primaryObjective}
Pages covered: ${targets.map((t) => t.name).join(", ")}

Task: Write 2 descriptions for a Dynamic Search Ad (DSA) catch-all ad group.
Google will auto-generate the headlines, so only write descriptions.
The descriptions should be generic enough to work for any page on this section of the site.

STRICT RULES:
- 2 Descriptions: EXACTLY 90 characters or less each.
- Do NOT include specific page names \u2014 keep it broad for the campaign section.

Respond with JSON in this exact format:
{
  "descriptions": ["Description 1", "Description 2"]
}`;

    if (onUpdate)
      onUpdate({
        step: "GENERATING_ADS",
        promptSnippet: "Generating DSA catch-all descriptions...",
        timestamp: Date.now(),
      });

    const dsaResult = await callAI(config, dsaPrompt, 30000);
    const dsaDescriptions = (dsaResult.descriptions || []).map((d: string) =>
      cleanAdCopy(d, 90),
    );

    const cleanPath = node.path.startsWith("/") ? node.path : `/${node.path}`;

    generatedAdGroups.push({
      id: `ag-dsa-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `DSA - ${node.name}`,
      isDSA: true,
      keywords: [],
      headlines: [],
      descriptions: dsaDescriptions,
      landingPageUrl: origin + cleanPath,
    });
  } catch (e) {
    console.warn(`DSA generation failed for ${node.name}, skipping`, e);
  }

  return {
    id: `camp-${node.path.replace(/[^a-z0-9]/gi, "")}-${Date.now()}`,
    name: node.name,
    objective: primaryObjective,
    adGroups: generatedAdGroups,
  };
};
