"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { getRowKey, type KeywordRow, type Overrides } from "@/lib/bid-engine";

interface OverridePanelProps {
  keywords: KeywordRow[];
  overrides: Overrides;
  onSetOverride: (key: string, bid: number) => void;
  onRemoveOverride: (key: string) => void;
}

export function OverridePanel({
  keywords,
  overrides,
  onSetOverride,
  onRemoveOverride,
}: OverridePanelProps) {
  const [selectedKey, setSelectedKey] = useState("");
  const [bidValue, setBidValue] = useState(0);

  const handleSelectChange = (value: string) => {
    setSelectedKey(value);
    if (value) {
      const row = keywords.find((k) => getRowKey(k) === value);
      setBidValue(row?.target_cpc ?? 0);
    }
  };

  const overrideEntries = Object.entries(overrides);

  return (
    <Card className="p-4 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700">
        Keyword Bid Overrides
      </h2>

      <Select
        label="Select keyword to override"
        value={selectedKey}
        onChange={(e) => handleSelectChange(e.target.value)}
      >
        <option value="">(none)</option>
        {keywords.map((row) => {
          const key = getRowKey(row);
          return (
            <option key={key} value={key}>
              {row.campaign} | {row.ad_group} | {row.keyword} | {row.match_type}
            </option>
          );
        })}
      </Select>

      {selectedKey && (
        <>
          <Input
            label="Override bid ($)"
            type="number"
            step={0.1}
            min={0}
            value={bidValue}
            onChange={(e) => setBidValue(parseFloat(e.target.value) || 0)}
          />
          <div className="flex gap-2">
            <Button onClick={() => onSetOverride(selectedKey, bidValue)}>
              Set Override
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                onRemoveOverride(selectedKey);
                setSelectedKey("");
              }}
            >
              Remove
            </Button>
          </div>
        </>
      )}

      {overrideEntries.length > 0 && (
        <div className="border-t border-gray-200 pt-3">
          <p className="text-xs font-semibold text-gray-600 mb-2">
            Active overrides:
          </p>
          <div className="space-y-1">
            {overrideEntries.map(([key, bid]) => (
              <div
                key={key}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-gray-600 truncate mr-2">{key}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono">${bid.toFixed(2)}</span>
                  <button
                    onClick={() => onRemoveOverride(key)}
                    className="text-red-600 hover:text-red-800 text-xs"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
