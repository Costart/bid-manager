"use client";

import { useState, useMemo, useCallback } from "react";
import {
  parseGoogleAdsCsv,
  calculateBids,
  computeAggregateStats,
  exportMicrosoftAdsCsv,
  type KeywordRow,
  type BidParams,
  type Overrides,
} from "@/lib/bid-engine";
import { Card } from "@/components/ui/Card";
import { FileUpload } from "./FileUpload";
import { BidSettings } from "./BidSettings";
import { OverridePanel } from "./OverridePanel";
import { FilterBar } from "./FilterBar";
import { StatsGrid } from "./StatsGrid";
import { KeywordTable } from "./KeywordTable";
import { ExportSection } from "./ExportSection";

const DEFAULT_PARAMS: BidParams = {
  profitMargin: 0.3,
  bidFloor: 0.1,
  bidCap: 50.0,
  minClicks: 50,
};

export function BidManagerClient() {
  const [rawRows, setRawRows] = useState<KeywordRow[] | null>(null);
  const [resultRows, setResultRows] = useState<KeywordRow[] | null>(null);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [params, setParams] = useState<BidParams>(DEFAULT_PARAMS);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [selectedAdGroup, setSelectedAdGroup] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleFileLoaded = useCallback(
    (csvText: string) => {
      setError(null);
      try {
        const parsed = parseGoogleAdsCsv(csvText);
        setRawRows(parsed);
        const calculated = calculateBids(parsed, params, overrides);
        setResultRows(calculated);
        setSelectedCampaign("");
        setSelectedAdGroup("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to parse CSV");
        setRawRows(null);
        setResultRows(null);
      }
    },
    [params, overrides]
  );

  const handleRecalculate = useCallback(() => {
    if (!rawRows) return;
    setError(null);
    try {
      const calculated = calculateBids(rawRows, params, overrides);
      setResultRows(calculated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to calculate bids");
    }
  }, [rawRows, params, overrides]);

  const handleSetOverride = useCallback(
    (key: string, bid: number) => {
      const newOverrides = { ...overrides, [key]: bid };
      setOverrides(newOverrides);
      if (rawRows) {
        setResultRows(calculateBids(rawRows, params, newOverrides));
      }
    },
    [overrides, rawRows, params]
  );

  const handleRemoveOverride = useCallback(
    (key: string) => {
      const newOverrides = { ...overrides };
      delete newOverrides[key];
      setOverrides(newOverrides);
      if (rawRows) {
        setResultRows(calculateBids(rawRows, params, newOverrides));
      }
    },
    [overrides, rawRows, params]
  );

  const handleExport = useCallback(
    (exportAll: boolean) => {
      const rows = exportAll ? resultRows : filteredRows;
      if (!rows || rows.length === 0) return;

      const csv = exportMicrosoftAdsCsv(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "microsoft_ads_bids.csv";
      a.click();
      URL.revokeObjectURL(url);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resultRows]
  );

  // Derived state
  const filteredRows = useMemo(() => {
    if (!resultRows) return [];
    let rows = resultRows;
    if (selectedCampaign) {
      rows = rows.filter((r) => r.campaign === selectedCampaign);
    }
    if (selectedAdGroup) {
      rows = rows.filter((r) => r.ad_group === selectedAdGroup);
    }
    return rows;
  }, [resultRows, selectedCampaign, selectedAdGroup]);

  const campaigns = useMemo(() => {
    if (!resultRows) return [];
    return [...new Set(resultRows.map((r) => r.campaign))].sort();
  }, [resultRows]);

  const adGroups = useMemo(() => {
    if (!resultRows) return [];
    const source = selectedCampaign
      ? resultRows.filter((r) => r.campaign === selectedCampaign)
      : resultRows;
    return [...new Set(source.map((r) => r.ad_group))].sort();
  }, [resultRows, selectedCampaign]);

  const stats = useMemo(() => {
    return computeAggregateStats(filteredRows);
  }, [filteredRows]);

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <aside className="w-72 shrink-0 space-y-4">
        <FileUpload onFileLoaded={handleFileLoaded} />
        <BidSettings
          params={params}
          onParamsChange={setParams}
          onRecalculate={handleRecalculate}
          disabled={!rawRows}
        />
        {resultRows && (
          <OverridePanel
            keywords={filteredRows}
            overrides={overrides}
            onSetOverride={handleSetOverride}
            onRemoveOverride={handleRemoveOverride}
          />
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-4">
        {error && (
          <Card className="p-4">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          </Card>
        )}

        {!resultRows && !error && (
          <Card className="p-4">
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
              Upload a Google Ads keyword report CSV to get started.
            </div>
          </Card>
        )}

        {resultRows && (
          <>
            <FilterBar
              campaigns={campaigns}
              adGroups={adGroups}
              selectedCampaign={selectedCampaign}
              selectedAdGroup={selectedAdGroup}
              onCampaignChange={(v) => {
                setSelectedCampaign(v);
                setSelectedAdGroup("");
              }}
              onAdGroupChange={setSelectedAdGroup}
            />

            <Card className="p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Review Before Export
              </h2>
              <StatsGrid stats={stats} />
            </Card>

            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">
                Keyword Bids ({filteredRows.length} keywords)
              </h2>
              <KeywordTable rows={filteredRows} />
            </div>

            <ExportSection
              onExport={handleExport}
              keywordCount={filteredRows.length}
            />
          </>
        )}
      </div>
    </div>
  );
}
