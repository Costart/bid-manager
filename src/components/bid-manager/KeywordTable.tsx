"use client";

import { cn } from "@/lib/utils";
import type { KeywordRow } from "@/lib/bid-engine";

interface KeywordTableProps {
  rows: KeywordRow[];
}

function formatMoney(value: number | undefined, showSign = false): string {
  if (value == null || isNaN(value)) return "$0.00";
  const sign = showSign && value > 0 ? "+" : "";
  return `${sign}$${value.toFixed(2)}`;
}

export function KeywordTable({ rows }: KeywordTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="max-h-[500px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr>
              <th className="px-3 py-3 text-left font-semibold text-gray-700">
                Keyword
              </th>
              <th className="px-3 py-3 text-left font-semibold text-gray-700">
                Match Type
              </th>
              <th className="px-3 py-3 text-left font-semibold text-gray-700">
                Campaign
              </th>
              <th className="px-3 py-3 text-left font-semibold text-gray-700">
                Ad Group
              </th>
              <th className="px-3 py-3 text-right font-semibold text-gray-700">
                Clicks
              </th>
              <th className="px-3 py-3 text-right font-semibold text-gray-700">
                Conversions
              </th>
              <th className="px-3 py-3 text-right font-semibold text-gray-700">
                Conv. Value
              </th>
              <th className="px-3 py-3 text-right font-semibold text-gray-700">
                Current CPC
              </th>
              <th className="px-3 py-3 text-right font-semibold text-gray-700">
                Target CPC
              </th>
              <th className="px-3 py-3 text-right font-semibold text-gray-700">
                Bid Delta
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const rowClass = row.insufficient_data
                ? "bg-gray-100"
                : row.profitability === "profitable"
                  ? "bg-green-50"
                  : row.profitability === "marginal"
                    ? "bg-yellow-50"
                    : "bg-red-50";

              const deltaClass =
                (row.bid_delta ?? 0) > 0
                  ? "text-emerald-600"
                  : (row.bid_delta ?? 0) < 0
                    ? "text-red-600"
                    : "";

              return (
                <tr
                  key={`${row.campaign}-${row.ad_group}-${row.keyword}-${row.match_type}-${i}`}
                  className={cn(rowClass, "border-b border-gray-100 hover:opacity-80")}
                >
                  <td className="px-3 py-2">{row.keyword}</td>
                  <td className="px-3 py-2">{row.match_type}</td>
                  <td className="px-3 py-2">{row.campaign}</td>
                  <td className="px-3 py-2">{row.ad_group}</td>
                  <td className="px-3 py-2 text-right">{row.clicks}</td>
                  <td className="px-3 py-2 text-right">
                    {row.conversions?.toFixed(1) ?? "0"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatMoney(row.conversion_value)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatMoney(row.current_max_cpc)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatMoney(row.target_cpc)}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right font-mono",
                      deltaClass
                    )}
                  >
                    {formatMoney(row.bid_delta, true)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
