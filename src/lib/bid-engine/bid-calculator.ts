import type { KeywordRow, BidParams, AggregateStats, Overrides } from "./types";

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function getRowKey(row: KeywordRow): string {
  return `${row.campaign}|${row.ad_group}|${row.keyword}|${row.match_type}`;
}

export function calculateBids(
  rows: KeywordRow[],
  params: BidParams,
  overrides: Overrides = {}
): KeywordRow[] {
  // Clone rows
  const result = rows.map((r) => ({ ...r }));

  // Step 1: Calculate per-row metrics
  for (const row of result) {
    if (row.clicks > 0) {
      row.conversion_rate = row.conversions / row.clicks;
      row.value_per_click = row.conversion_value / row.clicks;
      row.raw_target_cpc =
        (row.conversion_value * row.conversion_rate * (1 - params.profitMargin)) /
        row.clicks;
    } else {
      row.conversion_rate = NaN;
      row.value_per_click = NaN;
      row.raw_target_cpc = NaN;
    }

    row.insufficient_data = row.clicks < params.minClicks;
  }

  // Step 2: Compute ad-group averages from sufficient-data keywords
  const agSums = new Map<string, { sum: number; count: number }>();

  for (const row of result) {
    if (!row.insufficient_data && Number.isFinite(row.raw_target_cpc)) {
      const key = `${row.campaign}|${row.ad_group}`;
      const entry = agSums.get(key) || { sum: 0, count: 0 };
      entry.sum += row.raw_target_cpc!;
      entry.count += 1;
      agSums.set(key, entry);
    }
  }

  const agAvg = new Map<string, number>();
  for (const [key, { sum, count }] of agSums) {
    agAvg.set(key, sum / count);
  }

  // Step 3: Fill insufficient data with ad-group average, then floor
  for (const row of result) {
    row.target_cpc = row.raw_target_cpc;

    if (row.insufficient_data || !Number.isFinite(row.target_cpc)) {
      const agKey = `${row.campaign}|${row.ad_group}`;
      const avg = agAvg.get(agKey);
      row.target_cpc = avg !== undefined ? avg : params.bidFloor;
    }

    // Step 4: Clamp
    row.target_cpc = Math.max(params.bidFloor, Math.min(params.bidCap, row.target_cpc!));
  }

  // Step 5: Apply overrides
  for (const row of result) {
    const key = getRowKey(row);
    if (key in overrides) {
      row.target_cpc = overrides[key];
      row.is_overridden = true;
    } else {
      row.is_overridden = false;
    }
  }

  // Step 6: Compute bid_delta
  for (const row of result) {
    row.bid_delta = row.target_cpc! - row.current_max_cpc;
  }

  // Step 7: Profitability labels
  for (const row of result) {
    if (row.target_cpc! >= row.current_max_cpc) {
      row.profitability = "profitable";
    } else if (row.target_cpc! >= row.current_max_cpc * 0.9) {
      row.profitability = "marginal";
    } else {
      row.profitability = "unprofitable";
    }
  }

  // Step 8: Round
  for (const row of result) {
    if (Number.isFinite(row.raw_target_cpc)) {
      row.raw_target_cpc = round(row.raw_target_cpc!, 2);
    }
    row.target_cpc = round(row.target_cpc!, 2);
    row.bid_delta = round(row.bid_delta!, 2);
    if (Number.isFinite(row.value_per_click)) {
      row.value_per_click = round(row.value_per_click!, 2);
    }
    if (Number.isFinite(row.conversion_rate)) {
      row.conversion_rate = round(row.conversion_rate!, 4);
    }
  }

  return result;
}

export function computeAggregateStats(rows: KeywordRow[]): AggregateStats {
  const totalKeywords = rows.length;

  if (totalKeywords === 0) {
    return {
      totalKeywords: 0,
      avgBidChange: 0,
      increases: 0,
      decreases: 0,
      unchanged: 0,
      insufficientDataCount: 0,
      avgTargetCpc: 0,
      totalCurrentCost: 0,
    };
  }

  let bidDeltaSum = 0;
  let targetCpcSum = 0;
  let costSum = 0;
  let increases = 0;
  let decreases = 0;
  let unchanged = 0;
  let insufficientDataCount = 0;

  for (const row of rows) {
    const delta = row.bid_delta ?? 0;
    bidDeltaSum += delta;
    targetCpcSum += row.target_cpc ?? 0;
    costSum += row.cost ?? 0;

    if (delta > 0) increases++;
    else if (delta < 0) decreases++;
    else unchanged++;

    if (row.insufficient_data) insufficientDataCount++;
  }

  return {
    totalKeywords,
    avgBidChange: round(bidDeltaSum / totalKeywords, 2),
    increases,
    decreases,
    unchanged,
    insufficientDataCount,
    avgTargetCpc: round(targetCpcSum / totalKeywords, 2),
    totalCurrentCost: round(costSum, 2),
  };
}
