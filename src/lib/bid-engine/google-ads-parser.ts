import Papa from "papaparse";
import type { KeywordRow } from "./types";

const COLUMN_MAP: Record<string, keyof KeywordRow> = {
  Campaign: "campaign",
  "Ad group": "ad_group",
  "Ad Group": "ad_group",
  Keyword: "keyword",
  "Match type": "match_type",
  "Match Type": "match_type",
  "Max. CPC": "current_max_cpc",
  "Max CPC": "current_max_cpc",
  Clicks: "clicks",
  Impressions: "impressions",
  Conversions: "conversions",
  "Conv. value": "conversion_value",
  "Conversion value": "conversion_value",
  "Conv. Value": "conversion_value",
  Cost: "cost",
};

const REQUIRED_INTERNAL: (keyof KeywordRow)[] = [
  "campaign",
  "ad_group",
  "keyword",
  "match_type",
  "clicks",
  "conversions",
  "conversion_value",
];

const NUMERIC_FIELDS: (keyof KeywordRow)[] = [
  "current_max_cpc",
  "clicks",
  "impressions",
  "conversions",
  "conversion_value",
  "cost",
];

function cleanNumeric(value: string): number {
  const cleaned = String(value)
    .replace(/[$%,="]/g, "")
    .replace(/"/g, "")
    .trim();

  if (cleaned === "" || cleaned === "--" || cleaned === " --") {
    return 0;
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function parseGoogleAdsCsv(csvText: string): KeywordRow[] {
  // Strip BOM if present
  const text = csvText.replace(/^\uFEFF/, "");

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    throw new Error(`CSV parsing failed: ${parsed.errors[0].message}`);
  }

  // Trim column headers
  const rows = parsed.data.map((row) => {
    const trimmed: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      trimmed[key.trim()] = value;
    }
    return trimmed;
  });

  if (rows.length === 0) {
    throw new Error("CSV file is empty");
  }

  // Determine available columns
  const rawColumns = Object.keys(rows[0]);

  // Build rename map (first match wins for each target)
  const renameMap: Record<string, keyof KeywordRow> = {};
  const usedTargets = new Set<string>();
  for (const col of rawColumns) {
    const target = COLUMN_MAP[col];
    if (target && !usedTargets.has(target)) {
      renameMap[col] = target;
      usedTargets.add(target);
    }
  }

  // Validate required columns
  const missing = REQUIRED_INTERNAL.filter((c) => !usedTargets.has(c));
  if (missing.length > 0) {
    throw new Error(
      `Missing required columns: ${missing.join(", ")}. Found: ${rawColumns.join(", ")}`
    );
  }

  // Map and clean rows
  const result: KeywordRow[] = [];

  for (const raw of rows) {
    // Build mapped row
    const mapped: Record<string, string> = {};
    for (const [srcCol, value] of Object.entries(raw)) {
      const trimmedCol = srcCol.trim();
      const target = renameMap[trimmedCol];
      if (target) {
        mapped[target] = value;
      }
    }

    // Filter out total rows
    const campaign = mapped.campaign || "";
    if (!campaign || campaign.toLowerCase() === "total") {
      continue;
    }

    // Build KeywordRow with numeric cleaning
    const row: KeywordRow = {
      campaign,
      ad_group: mapped.ad_group || "",
      keyword: mapped.keyword || "",
      match_type: mapped.match_type || "",
      current_max_cpc: 0,
      clicks: 0,
      impressions: 0,
      conversions: 0,
      conversion_value: 0,
      cost: 0,
    };

    for (const field of NUMERIC_FIELDS) {
      if (mapped[field] !== undefined) {
        (row[field] as number) = cleanNumeric(mapped[field]);
      }
    }

    // Ensure integer fields
    row.clicks = Math.round(row.clicks);
    row.impressions = Math.round(row.impressions);

    result.push(row);
  }

  return result;
}
