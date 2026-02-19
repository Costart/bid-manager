import Papa from "papaparse";
import type { KeywordRow } from "./types";

const MATCH_TYPE_MAP: Record<string, string> = {
  "Exact match": "Exact",
  Exact: "Exact",
  "Phrase match": "Phrase",
  Phrase: "Phrase",
  "Broad match": "Broad",
  Broad: "Broad",
};

export function exportMicrosoftAdsCsv(rows: KeywordRow[]): string {
  const data = rows.map((row) => ({
    Type: "Keyword",
    Status: "Active",
    Campaign: row.campaign,
    "Ad Group": row.ad_group,
    Keyword: row.keyword,
    "Match Type": MATCH_TYPE_MAP[row.match_type] || "Broad",
    Bid: (row.target_cpc ?? 0).toFixed(2),
  }));

  return Papa.unparse(data);
}
