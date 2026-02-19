"use client";

import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";

interface FilterBarProps {
  campaigns: string[];
  adGroups: string[];
  selectedCampaign: string;
  selectedAdGroup: string;
  onCampaignChange: (value: string) => void;
  onAdGroupChange: (value: string) => void;
}

export function FilterBar({
  campaigns,
  adGroups,
  selectedCampaign,
  selectedAdGroup,
  onCampaignChange,
  onAdGroupChange,
}: FilterBarProps) {
  return (
    <Card className="p-4">
      <div className="flex gap-4">
        <div className="flex-1">
          <Select
            label="Filter Campaigns"
            value={selectedCampaign}
            onChange={(e) => onCampaignChange(e.target.value)}
          >
            <option value="">All Campaigns</option>
            {campaigns.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex-1">
          <Select
            label="Filter Ad Groups"
            value={selectedAdGroup}
            onChange={(e) => onAdGroupChange(e.target.value)}
          >
            <option value="">All Ad Groups</option>
            {adGroups.map((ag) => (
              <option key={ag} value={ag}>
                {ag}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </Card>
  );
}
