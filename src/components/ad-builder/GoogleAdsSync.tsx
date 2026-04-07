"use client";

import React, { useState } from "react";
import { RefreshCw, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import type { Campaign, AdGroup } from "@/lib/ad-builder/types";

interface SyncedAdGroup {
  resourceName: string;
  name: string;
  status: string;
  type: string;
  keywords: { text: string; matchType: string }[];
  headlines: string[];
  descriptions: string[];
  finalUrl: string;
}

interface SyncedCampaign {
  resourceName: string;
  name: string;
  status: string;
  adGroups: SyncedAdGroup[];
}

interface GoogleAdsSyncProps {
  campaigns: Campaign[];
  disabled?: boolean;
  onSynced?: (updatedCampaigns: Campaign[]) => void;
}

export default function GoogleAdsSync({
  campaigns,
  disabled = false,
  onSynced,
}: GoogleAdsSyncProps) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const syncableCampaigns = campaigns.filter(
    (c) => c.uploaded && c.googleAdsResourceName,
  );

  const handleSync = async () => {
    if (syncableCampaigns.length === 0) return;

    setSyncing(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/google-ads/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignResourceNames: syncableCampaigns.map(
            (c) => c.googleAdsResourceName,
          ),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Sync failed");
        return;
      }

      const syncedMap = new Map<string, SyncedCampaign>();
      for (const sc of data.campaigns as SyncedCampaign[]) {
        syncedMap.set(sc.resourceName, sc);
      }

      // Merge synced data into local campaigns
      let changeCount = 0;
      const updatedCampaigns = campaigns.map((camp) => {
        if (!camp.googleAdsResourceName) return camp;
        const synced = syncedMap.get(camp.googleAdsResourceName);
        if (!synced) return camp;

        let changed = false;
        const updates: Partial<Campaign> = {};

        // Update campaign name
        if (synced.name !== camp.name) {
          updates.name = synced.name;
          changed = true;
        }

        // Update campaign status
        const newStatus = synced.status as Campaign["googleAdsStatus"];
        if (newStatus && newStatus !== camp.googleAdsStatus) {
          updates.googleAdsStatus = newStatus;
          changed = true;
        }

        // Build ad group resource map for matching
        const syncedAgMap = new Map<string, SyncedAdGroup>();
        for (const sag of synced.adGroups) {
          syncedAgMap.set(sag.resourceName, sag);
        }

        // Update ad groups
        const updatedAdGroups = camp.adGroups.map((ag) => {
          if (!ag.googleAdsResourceName) return ag;
          const sag = syncedAgMap.get(ag.googleAdsResourceName);
          if (!sag) return ag;

          const agUpdates: Partial<AdGroup> = {};
          let agChanged = false;

          if (sag.name !== ag.name) {
            agUpdates.name = sag.name;
            agChanged = true;
          }

          if (sag.keywords.length > 0) {
            const newKeywords = sag.keywords.map((k) => k.text);
            if (JSON.stringify(newKeywords) !== JSON.stringify(ag.keywords)) {
              agUpdates.keywords = newKeywords;
              agChanged = true;
            }
          }

          if (sag.headlines.length > 0) {
            if (
              JSON.stringify(sag.headlines) !== JSON.stringify(ag.headlines)
            ) {
              agUpdates.headlines = sag.headlines;
              agChanged = true;
            }
          }

          if (sag.descriptions.length > 0) {
            if (
              JSON.stringify(sag.descriptions) !==
              JSON.stringify(ag.descriptions)
            ) {
              agUpdates.descriptions = sag.descriptions;
              agChanged = true;
            }
          }

          if (sag.finalUrl && sag.finalUrl !== ag.landingPageUrl) {
            agUpdates.landingPageUrl = sag.finalUrl;
            agChanged = true;
          }

          if (agChanged) {
            changed = true;
            return { ...ag, ...agUpdates };
          }
          return ag;
        });

        if (changed) {
          changeCount++;
          return {
            ...camp,
            ...updates,
            adGroups: updatedAdGroups,
            lastSyncedAt: new Date().toISOString(),
          };
        }

        return { ...camp, lastSyncedAt: new Date().toISOString() };
      });

      if (onSynced) {
        onSynced(updatedCampaigns);
      }

      setResult(
        changeCount > 0
          ? `Synced: ${changeCount} campaign${changeCount !== 1 ? "s" : ""} updated`
          : `Synced: all ${syncableCampaigns.length} campaigns up to date`,
      );
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSyncing(false);
    }
  };

  if (result) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle className="w-3.5 h-3.5" />
          <span>{result}</span>
        </div>
        <button
          onClick={() => setResult(null)}
          className="text-xs text-slate-400 hover:text-slate-600"
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

  return (
    <button
      onClick={handleSync}
      disabled={disabled || syncing || syncableCampaigns.length === 0}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title={
        syncableCampaigns.length === 0
          ? "No uploaded campaigns to sync"
          : `Sync ${syncableCampaigns.length} campaigns from Google Ads`
      }
    >
      {syncing ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <RefreshCw className="w-3.5 h-3.5" />
      )}
      {syncing ? "Syncing..." : "Sync from Ads"}
    </button>
  );
}
