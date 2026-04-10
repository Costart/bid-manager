import { AIConfig } from "./aiConfig";
import {
  FolderNode,
  Campaign,
  AdGroup,
  AIDebugInfo,
  HreflangEntry,
  LanguageGroup,
} from "./types";

const PROXIES = [
  "/api/proxy?url=",
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
      const isOwnProxy = proxy.startsWith("/");
      const fullUrl = proxy + encodeURIComponent(targetUrl);
      console.log(`[proxy] Trying: ${fullUrl.slice(0, 100)}`);
      const response = await fetchWithTimeout(
        fullUrl,
        {},
        isOwnProxy ? 12000 : 6000,
      );
      console.log(`[proxy] ${response.status} for ${targetUrl.slice(0, 60)}`);
      if (response.ok) {
        const text = await response.text();
        if (text && text.length > 50) return text;
        console.log(`[proxy] Response too short (${text.length} chars)`);
      }
    } catch (e) {
      console.log(`[proxy] Error for ${targetUrl.slice(0, 60)}:`, e);
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
  hreflangMap: Map<string, HreflangEntry[]>;
} {
  const urls: string[] = [];
  const sitemaps: string[] = [];
  const hreflangMap = new Map<string, HreflangEntry[]>();

  const sitemapRegex = /<sitemap>[\s\S]*?<loc>(.*?)<\/loc>[\s\S]*?<\/sitemap>/g;
  let sitemapMatch;
  while ((sitemapMatch = sitemapRegex.exec(xmlContent)) !== null) {
    if (sitemapMatch[1]) sitemaps.push(sitemapMatch[1].trim());
  }

  // Match full <url> blocks to extract both <loc> and hreflang <xhtml:link> / <link> tags
  const urlBlockRegex = /<url>([\s\S]*?)<\/url>/g;
  let blockMatch;
  while ((blockMatch = urlBlockRegex.exec(xmlContent)) !== null) {
    const block = blockMatch[1];
    const locMatch = block.match(/<loc>(.*?)<\/loc>/);
    if (!locMatch?.[1]) continue;
    const loc = locMatch[1].trim();
    urls.push(loc);

    // Parse hreflang links: <xhtml:link rel="alternate" hreflang="es" href="..." />
    // Also handles <link rel="alternate" ...> without xhtml prefix
    const hreflangRegex =
      /<(?:xhtml:)?link[^>]*rel=["']alternate["'][^>]*hreflang=["']([^"']+)["'][^>]*href=["']([^"']+)["'][^>]*\/?>/g;
    // Also try reversed attribute order: hreflang before rel
    const hreflangRegex2 =
      /<(?:xhtml:)?link[^>]*hreflang=["']([^"']+)["'][^>]*href=["']([^"']+)["'][^>]*\/?>/g;

    const entries: HreflangEntry[] = [];
    let hm: RegExpExecArray | null;
    while ((hm = hreflangRegex.exec(block)) !== null) {
      entries.push({ lang: hm[1].trim(), url: hm[2].trim() });
    }
    while ((hm = hreflangRegex2.exec(block)) !== null) {
      // Avoid duplicates from first regex
      const href = hm[2].trim();
      const lang = hm[1].trim();
      if (!entries.some((e) => e.url === href && e.lang === lang)) {
        entries.push({ lang, url: href });
      }
    }

    if (entries.length > 0) {
      hreflangMap.set(loc, entries);
    }
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

  return { urls, sitemaps, hreflangMap };
}

async function crawlSitemaps(
  startUrl: string,
  maxDepth = 2,
  currentDepth = 0,
): Promise<{ urls: string[]; hreflangMap: Map<string, HreflangEntry[]> }> {
  const content = await fetchUrlContent(startUrl);
  if (!content) return { urls: [], hreflangMap: new Map() };

  const { urls, sitemaps, hreflangMap } = parseSitemapRaw(content);
  const allUrls = [...urls];
  const mergedMap = new Map(hreflangMap);

  if (sitemaps.length > 0 && currentDepth < maxDepth) {
    for (const subSitemap of sitemaps) {
      const child = await crawlSitemaps(
        subSitemap,
        maxDepth,
        currentDepth + 1,
      );
      allUrls.push(...child.urls);
      for (const [key, val] of child.hreflangMap) {
        mergedMap.set(key, val);
      }
    }
  }
  return { urls: allUrls, hreflangMap: mergedMap };
}

export const fetchRawUrls = async (
  url: string,
  sitemapUrl?: string,
): Promise<{ urls: string[]; hreflangMap: Map<string, HreflangEntry[]> }> => {
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
  const mergedHreflang = new Map<string, HreflangEntry[]>();

  for (const candidate of candidates) {
    const result = await crawlSitemaps(candidate);
    const validUrls = result.urls.filter(
      (u) =>
        u.startsWith("http") && !u.match(/\.(jpg|jpeg|png|gif|webp|pdf)$/i),
    );
    if (validUrls.length > 0) foundUrls.push(...validUrls);
    for (const [key, val] of result.hreflangMap) {
      mergedHreflang.set(key, val);
    }
  }

  foundUrls = [...new Set(foundUrls)];

  if (foundUrls.length === 0) {
    throw new Error(
      "No URLs found via sitemap. Try pasting URLs manually in 'Fast Options'.",
    );
  }

  return { urls: foundUrls, hreflangMap: mergedHreflang };
};

function getLanguageDisplayName(langCode: string): string {
  try {
    const display = new Intl.DisplayNames(["en"], { type: "language" });
    const name = display.of(langCode);
    if (name && name !== langCode) return name;
  } catch {
    // fallback
  }
  return langCode.toUpperCase();
}

// Common 2-3 letter language codes used as URL path prefixes
const KNOWN_LANG_CODES = new Set([
  "en", "es", "fr", "de", "it", "pt", "nl", "ru", "ja", "ko", "zh", "ar",
  "hi", "th", "vi", "id", "ms", "tr", "pl", "cs", "sk", "hu", "ro", "bg",
  "hr", "sr", "sl", "uk", "da", "sv", "no", "fi", "el", "he", "ca", "fil",
  "et", "lv", "lt", "yue",
]);

export function detectLangFromUrlPath(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    // Match first path segment: /en, /en/, /en/something
    const match = pathname.match(/^\/([a-z]{2,3})(\/|$)/i);
    if (match) {
      const code = match[1].toLowerCase();
      if (KNOWN_LANG_CODES.has(code)) return code;
    }
  } catch {
    // ignore
  }
  return null;
}

export function groupUrlsByLanguage(
  urls: string[],
  hreflangMap: Map<string, HreflangEntry[]>,
): LanguageGroup[] {
  // Build a url -> lang mapping from hreflang data
  const urlToLang = new Map<string, string>();

  for (const [sourceUrl, entries] of hreflangMap) {
    for (const entry of entries) {
      if (entry.lang === "x-default") continue;
      // Normalize: just use the primary language subtag (e.g. "en-US" -> "en")
      const primaryLang = entry.lang.split("-")[0].toLowerCase();
      urlToLang.set(entry.url, primaryLang);
    }
    // If the source URL itself appears in its own hreflang list, it's already mapped.
    // If not, try to infer from entries that point to it.
    if (!urlToLang.has(sourceUrl)) {
      const selfEntry = entries.find((e) => e.url === sourceUrl && e.lang !== "x-default");
      if (selfEntry) {
        urlToLang.set(sourceUrl, selfEntry.lang.split("-")[0].toLowerCase());
      }
    }
  }

  // Fallback: if no hreflang data, detect language from URL path prefixes (e.g. /en/, /es/)
  const isPathBased = urlToLang.size === 0;
  if (isPathBased) {
    for (const url of urls) {
      const lang = detectLangFromUrlPath(url);
      if (lang) urlToLang.set(url, lang);
    }
  }

  if (urlToLang.size === 0) return [];

  // Group discovered URLs by language
  const groups = new Map<string, string[]>();
  for (const url of urls) {
    const lang = urlToLang.get(url);
    if (!lang) continue;
    if (!groups.has(lang)) groups.set(lang, []);
    groups.get(lang)!.push(url);
  }

  // If only one language found, no need to split
  if (groups.size <= 1) return [];

  const source = isPathBased ? "path" : "hreflang";
  return Array.from(groups.entries()).map(([lang, langUrls]) => ({
    lang,
    displayName: getLanguageDisplayName(lang),
    urls: langUrls,
    source: source as "hreflang" | "path",
  }));
}

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
  language?: string,
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

      const langDisplayName = language ? getLanguageDisplayName(language) : "";
      const languageRule = language
        ? `\nTarget Language: ${langDisplayName}\nIMPORTANT: Generate ALL keywords in ${langDisplayName}. The landing page is in ${langDisplayName}.`
        : "";

      const keywordPrompt = `You are a Google Ads Strategist.
Page Context: ${context}
${locationRule}${languageRule}
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

      const adLanguageRule = language
        ? `\n- Target Language: ${langDisplayName}. Write ALL headlines and descriptions in ${langDisplayName}.`
        : "";

      const creativePrompt = `You are a Google Ads Copywriter.
Context: ${context}
Keywords: ${step1Result.keywords.join(", ")}

Task: Write Responsive Search Ad (RSA) copy.

STRICT RULES:
- 5 Headlines: EXACTLY 30 characters or less. NO trailing periods.
- 3 Descriptions: EXACTLY 90 characters or less.
- If a line is too long, the system will reject it. Be concise.${adLocationRule}${adLanguageRule}

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

      // Step 3: Generate sitelinks and callouts
      const sitelinkLanguageRule = language
        ? `\n- Write ALL text in ${langDisplayName}.`
        : "";

      const sitelinkPrompt = `You are a Google Ads Extensions Specialist.
Context: ${context}
Landing Page: ${targetUrl}

Task: Generate 4 sitelinks and 4 callouts for this ad group.

SITELINKS — each sitelink needs:
- linkText: Max 25 characters. A compelling link title.
- description1: Max 35 characters. First description line.
- description2: Max 35 characters. Second description line.
- finalUrl: Use "${targetUrl}" as the base, append a relevant anchor or path if applicable, otherwise use the landing page URL.

CALLOUTS — each callout:
- Max 25 characters. Short value propositions or features from the page.${sitelinkLanguageRule}

Respond with JSON in this exact format:
{
  "sitelinks": [
    { "linkText": "Link Text", "description1": "First line", "description2": "Second line", "finalUrl": "${targetUrl}" }
  ],
  "callouts": ["Callout 1", "Callout 2", "Callout 3", "Callout 4"]
}`;

      let sitelinks: { linkText: string; description1: string; description2: string; finalUrl: string }[] = [];
      let callouts: string[] = [];

      try {
        const step3Result = await callAI(config, sitelinkPrompt, STEP_TIMEOUT_MS);
        sitelinks = (step3Result.sitelinks || []).map((sl: any) => ({
          linkText: cleanAdCopy(sl.linkText || "", 25),
          description1: cleanAdCopy(sl.description1 || "", 35),
          description2: cleanAdCopy(sl.description2 || "", 35),
          finalUrl: sl.finalUrl || targetUrl,
        }));
        callouts = (step3Result.callouts || []).map((c: string) =>
          cleanAdCopy(c, 25),
        );
      } catch (e) {
        console.warn(`Sitelink/callout generation failed for ${targetUrl}, skipping`, e);
      }

      if (onUpdate)
        onUpdate({
          step: "COMPLETE",
          rawResponse: JSON.stringify(
            { ...step1Result, ...step2Result, sitelinks, callouts },
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
          sitelinks: sitelinks.length > 0 ? sitelinks : undefined,
          callouts: callouts.length > 0 ? callouts : undefined,
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
  language?: string,
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
        language,
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
    const dsaLangDisplayName = language ? getLanguageDisplayName(language) : "";
    const dsaLanguageRule = language
      ? `\n- Target Language: ${dsaLangDisplayName}. Write ALL descriptions in ${dsaLangDisplayName}.`
      : "";

    const dsaPrompt = `You are a Google Ads Copywriter.
Campaign: "${node.name}" for ${siteName}
Campaign objective: ${primaryObjective}
Pages covered: ${targets.map((t) => t.name).join(", ")}

Task: Write 2 descriptions for a Dynamic Search Ad (DSA) catch-all ad group.
Google will auto-generate the headlines, so only write descriptions.
The descriptions should be generic enough to work for any page on this section of the site.

STRICT RULES:
- 2 Descriptions: EXACTLY 90 characters or less each.
- Do NOT include specific page names \u2014 keep it broad for the campaign section.${dsaLanguageRule}

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

  const campaignName = language
    ? `${node.name} [${language.toUpperCase()}]`
    : node.name;

  return {
    id: `camp-${node.path.replace(/[^a-z0-9]/gi, "")}-${language || "def"}-${Date.now()}`,
    name: campaignName,
    objective: primaryObjective,
    adGroups: generatedAdGroups,
    language,
    languageDisplay: language ? getLanguageDisplayName(language) : undefined,
  };
};
