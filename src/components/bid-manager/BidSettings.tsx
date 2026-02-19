"use client";

import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Slider } from "@/components/ui/Slider";
import { Button } from "@/components/ui/Button";
import type { BidParams } from "@/lib/bid-engine";

interface BidSettingsProps {
  params: BidParams;
  onParamsChange: (params: BidParams) => void;
  onRecalculate: () => void;
  disabled: boolean;
}

export function BidSettings({
  params,
  onParamsChange,
  onRecalculate,
  disabled,
}: BidSettingsProps) {
  const marginPercent = Math.round(params.profitMargin * 100);

  return (
    <Card className="p-4 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700">Settings</h2>

      <Slider
        label="Profit Margin"
        displayValue={`${marginPercent}%`}
        min={0}
        max={90}
        value={marginPercent}
        onChange={(e) =>
          onParamsChange({
            ...params,
            profitMargin: parseInt(e.target.value) / 100,
          })
        }
      />

      <Input
        label="Bid Floor ($)"
        type="number"
        value={params.bidFloor}
        step={0.05}
        min={0}
        onChange={(e) =>
          onParamsChange({ ...params, bidFloor: parseFloat(e.target.value) || 0 })
        }
      />

      <Input
        label="Bid Cap ($)"
        type="number"
        value={params.bidCap}
        step={1}
        min={0}
        onChange={(e) =>
          onParamsChange({ ...params, bidCap: parseFloat(e.target.value) || 0 })
        }
      />

      <Input
        label="Min Clicks (data threshold)"
        type="number"
        value={params.minClicks}
        step={10}
        min={0}
        onChange={(e) =>
          onParamsChange({
            ...params,
            minClicks: parseInt(e.target.value) || 0,
          })
        }
      />

      <Button
        onClick={onRecalculate}
        disabled={disabled}
        className="w-full"
      >
        Recalculate Bids
      </Button>
    </Card>
  );
}
