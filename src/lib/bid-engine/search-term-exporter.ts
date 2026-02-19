import Papa from "papaparse";
import type { SearchTermResult } from "./types";

export function exportSearchTermsCsv(terms: SearchTermResult[]): string {
  const data = terms.map((t) => ({
    Type: "Keyword",
    Status: "Active",
    Campaign: t.campaign,
    "Ad Group": t.adGroup,
    Keyword: t.searchTerm,
    "Match Type": "Phrase",
    Bid: (t.suggestedBid ?? 0).toFixed(2),
  }));

  return Papa.unparse(data);
}
