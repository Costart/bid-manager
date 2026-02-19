export interface KeywordRow {
  campaign: string;
  ad_group: string;
  keyword: string;
  match_type: string;
  current_max_cpc: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversion_value: number;
  cost: number;
  // Calculated fields (added by bid calculator)
  conversion_rate?: number;
  value_per_click?: number;
  raw_target_cpc?: number;
  target_cpc?: number;
  bid_delta?: number;
  profitability?: Profitability;
  insufficient_data?: boolean;
  is_overridden?: boolean;
}

export interface BidParams {
  profitMargin: number; // 0.0 to 1.0
  bidFloor: number;
  bidCap: number;
  minClicks: number;
}

export interface AggregateStats {
  totalKeywords: number;
  avgBidChange: number;
  increases: number;
  decreases: number;
  unchanged: number;
  insufficientDataCount: number;
  avgTargetCpc: number;
  totalCurrentCost: number;
}

export type Profitability = "profitable" | "marginal" | "unprofitable";

export type Overrides = Record<string, number>;

export interface SearchTermResult {
  searchTerm: string;
  campaign: string;
  adGroup: string;
  clicks: number;
  impressions: number;
  conversions: number;
  conversionValue: number;
  cost: number;
  // Calculated
  suggestedBid?: number;
  valuePerClick?: number;
  conversionRate?: number;
  selected?: boolean;
}

export interface AdGroupBidSuggestion {
  campaign: string;
  adGroup: string;
  suggestedBid: number;
  searchTermCount: number;
  totalConversions: number;
  totalValue: number;
}
