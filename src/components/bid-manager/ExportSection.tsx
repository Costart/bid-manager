"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface ExportSectionProps {
  onExport: (exportAll: boolean) => void;
  keywordCount: number;
}

export function ExportSection({ onExport, keywordCount }: ExportSectionProps) {
  const [exportAll, setExportAll] = useState(false);

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Export</h2>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={exportAll}
            onChange={(e) => setExportAll(e.target.checked)}
            className="rounded border-gray-300"
          />
          Export all keywords (ignore filters)
        </label>
        <Button onClick={() => onExport(exportAll)}>
          Download Microsoft Ads CSV ({keywordCount} keywords)
        </Button>
      </div>
    </Card>
  );
}
