"use client";

import { StatCard } from "@/components/ui/StatCard";
import type { AggregateStats } from "@/lib/bid-engine";

interface StatsGridProps {
  stats: AggregateStats;
}

function formatMoney(value: number, showSign = false): string {
  const sign = showSign && value > 0 ? "+" : "";
  return `${sign}$${value.toFixed(2)}`;
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <StatCard value={stats.totalKeywords} label="Total Keywords" />
      <StatCard
        value={formatMoney(stats.avgBidChange, true)}
        label="Avg Bid Change"
      />
      <StatCard value={stats.increases} label="Bid Increases" />
      <StatCard value={stats.decreases} label="Bid Decreases" />
      <StatCard
        value={formatMoney(stats.avgTargetCpc)}
        label="Avg Target CPC"
      />
      <StatCard
        value={stats.insufficientDataCount}
        label="Insufficient Data"
      />
      <StatCard
        value={formatMoney(stats.totalCurrentCost)}
        label="Total Current Cost"
      />
      <StatCard value={stats.unchanged} label="Unchanged" />
    </div>
  );
}
