import type { SearchTermResult, AdGroupBidSuggestion, BidParams } from "./types";

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function calculateSearchTermBids(
  terms: SearchTermResult[],
  params: Pick<BidParams, "profitMargin" | "bidFloor" | "bidCap">,
): SearchTermResult[] {
  return terms.map((term) => {
    const result = { ...term };

    if (term.clicks > 0) {
      result.valuePerClick = round(term.conversionValue / term.clicks, 2);
      result.conversionRate = round(term.conversions / term.clicks, 4);
      const rawBid = result.valuePerClick * (1 - params.profitMargin);
      result.suggestedBid = round(
        Math.max(params.bidFloor, Math.min(params.bidCap, rawBid)),
        2,
      );
    } else {
      result.valuePerClick = 0;
      result.conversionRate = 0;
      result.suggestedBid = params.bidFloor;
    }

    return result;
  });
}

export function calculateAdGroupBids(
  terms: SearchTermResult[],
): AdGroupBidSuggestion[] {
  const groups = new Map<
    string,
    { campaign: string; adGroup: string; bids: number[]; conversions: number; value: number }
  >();

  for (const term of terms) {
    if (!term.suggestedBid) continue;
    const key = `${term.campaign}|${term.adGroup}`;
    const group = groups.get(key) || {
      campaign: term.campaign,
      adGroup: term.adGroup,
      bids: [],
      conversions: 0,
      value: 0,
    };
    group.bids.push(term.suggestedBid);
    group.conversions += term.conversions;
    group.value += term.conversionValue;
    groups.set(key, group);
  }

  return Array.from(groups.values()).map((g) => ({
    campaign: g.campaign,
    adGroup: g.adGroup,
    suggestedBid: round(
      g.bids.reduce((sum, b) => sum + b, 0) / g.bids.length,
      2,
    ),
    searchTermCount: g.bids.length,
    totalConversions: round(g.conversions, 1),
    totalValue: round(g.value, 2),
  }));
}
