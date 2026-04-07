"use client";

import React, { useState } from "react";
import {
  CloudUpload,
  Loader2,
  CheckCircle,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import type { Campaign } from "@/lib/ad-builder/types";

interface CampaignResult {
  campaignName: string;
  success: boolean;
  adGroupCount: number;
  error?: string;
}

interface UploadResponse {
  results: CampaignResult[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

interface GoogleAdsUploadProps {
  campaigns: Campaign[];
  disabled?: boolean;
  onUploaded?: (uploadedCampaignIds: string[]) => void;
}

export default function GoogleAdsUpload({
  campaigns,
  disabled = false,
  onUploaded,
}: GoogleAdsUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingCampaigns = campaigns.filter((c) => !c.uploaded);

  const handleUpload = async () => {
    if (pendingCampaigns.length === 0) return;

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/google-ads/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaigns: pendingCampaigns }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }

      setResult(data);

      // Mark successful campaigns as uploaded
      if (onUploaded) {
        const successNames = new Set(
          data.results
            .filter((r: CampaignResult) => r.success)
            .map((r: CampaignResult) => r.campaignName),
        );
        const uploadedIds = pendingCampaigns
          .filter((c) => successNames.has(c.name))
          .map((c) => c.id);
        if (uploadedIds.length > 0) onUploaded(uploadedIds);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleRetryFailed = async () => {
    if (!result) return;
    const failedNames = new Set(
      result.results.filter((r) => !r.success).map((r) => r.campaignName),
    );
    const failedCampaigns = pendingCampaigns.filter((c) =>
      failedNames.has(c.name),
    );
    if (failedCampaigns.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const res = await fetch("/api/google-ads/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaigns: failedCampaigns }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Retry failed");
        return;
      }

      const prevSuccessful = result.results.filter((r) => r.success);
      setResult({
        results: [...prevSuccessful, ...data.results],
        summary: {
          total: pendingCampaigns.length,
          succeeded:
            prevSuccessful.length +
            data.results.filter((r: CampaignResult) => r.success).length,
          failed: data.results.filter((r: CampaignResult) => !r.success)
            .length,
        },
      });

      // Mark newly successful campaigns as uploaded
      if (onUploaded) {
        const successNames = new Set(
          data.results
            .filter((r: CampaignResult) => r.success)
            .map((r: CampaignResult) => r.campaignName),
        );
        const uploadedIds = failedCampaigns
          .filter((c) => successNames.has(c.name))
          .map((c) => c.id);
        if (uploadedIds.length > 0) onUploaded(uploadedIds);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (result) {
    const allSuccess = result.summary.failed === 0;
    return (
      <div className="flex flex-col gap-2">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
            allSuccess
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-amber-50 text-amber-700 border border-amber-200"
          }`}
        >
          {allSuccess ? (
            <CheckCircle className="w-3.5 h-3.5" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5" />
          )}
          <span>
            {result.summary.succeeded}/{result.summary.total} campaigns
            uploaded (PAUSED)
          </span>
        </div>

        {result.summary.failed > 0 && (
          <div className="flex flex-col gap-1">
            {result.results
              .filter((r) => !r.success)
              .map((r, i) => (
                <p key={i} className="text-xs text-red-600 pl-1">
                  {r.campaignName}: {r.error}
                </p>
              ))}
            <button
              onClick={handleRetryFailed}
              disabled={uploading}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors w-fit"
            >
              <RotateCcw className="w-3 h-3" />
              Retry Failed
            </button>
          </div>
        )}

        <button
          onClick={() => setResult(null)}
          className="text-xs text-slate-400 hover:text-slate-600 w-fit"
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-red-50 text-red-700 border border-red-200">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{error}</span>
        </div>
        <button
          onClick={() => setError(null)}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          Dismiss
        </button>
      </div>
    );
  }

  const alreadyUploaded = campaigns.length - pendingCampaigns.length;

  return (
    <button
      onClick={handleUpload}
      disabled={disabled || uploading || pendingCampaigns.length === 0}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {uploading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <CloudUpload className="w-3.5 h-3.5" />
      )}
      {uploading
        ? "Uploading..."
        : pendingCampaigns.length === 0
          ? `All ${campaigns.length} Pushed`
          : `Push ${pendingCampaigns.length} New to Google Ads`}
      {alreadyUploaded > 0 && pendingCampaigns.length > 0 && (
        <span className="bg-white/20 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
          {alreadyUploaded} already pushed
        </span>
      )}
    </button>
  );
}
