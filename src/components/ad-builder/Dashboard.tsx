"use client";

import React, { useState, useEffect } from "react";
import {
  SiteAnalysis,
  Campaign,
  AdGroup,
  AIDebugInfo,
  AIHistoryEntry,
} from "@/lib/ad-builder/types";
import { exportToGoogleAdsCSV } from "@/lib/ad-builder/csvExporter";
import { useGoogleAdsStatus } from "@/lib/hooks/use-google-ads";
import GoogleAdsConnect from "@/components/ad-builder/GoogleAdsConnect";
import GoogleAdsUpload from "@/components/ad-builder/GoogleAdsUpload";
import {
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Zap,
  RefreshCw,
  ScanSearch,
  Download,
  Loader2,
  Table,
  LayoutList,
  Terminal,
  Cpu,
  FileJson,
  History,
  ShieldCheck,
} from "lucide-react";

interface DashboardProps {
  analysis: SiteAnalysis;
  onReset: () => void;
  onRescan?: () => void;
  isGenerating?: boolean;
  isFixing?: boolean;
  onFixCompliance?: () => void;
  onCampaignsUploaded?: (campaignIds: string[]) => void;
  progress?: {
    current: number;
    total: number;
    currentEntity?: string;
  };
  debugInfo?: AIDebugInfo;
  aiHistory: AIHistoryEntry[];
}

const Dashboard: React.FC<DashboardProps> = ({
  analysis,
  onReset,
  onRescan,
  isGenerating = false,
  isFixing = false,
  onFixCompliance,
  onCampaignsUploaded,
  progress,
  debugInfo,
  aiHistory,
}) => {
  const googleAds = useGoogleAdsStatus();

  const [viewMode, setViewMode] = useState<"detail" | "table" | "logs">(
    "table",
  );
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  useEffect(() => {
    if (isGenerating) setShowDebug(true);
  }, [isGenerating]);

  useEffect(() => {
    if (
      viewMode === "detail" &&
      !expandedCampaign &&
      analysis.campaigns.length > 0
    ) {
      setExpandedCampaign(analysis.campaigns[0].id);
    }
  }, [analysis.campaigns, expandedCampaign, viewMode]);

  const handleExport = () => {
    exportToGoogleAdsCSV(analysis.campaigns);
  };

  const progressPercentage =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  const adCopyErrorCount = analysis.campaigns.reduce((total, camp) => {
    return (
      total +
      camp.adGroups.reduce((groupTotal, group) => {
        const headlineErrors = (group.headlines || []).filter(
          (h) => h.length > 30,
        ).length;
        const descErrors = (group.descriptions || []).filter(
          (d) => d.length > 90,
        ).length;
        return groupTotal + headlineErrors + descErrors;
      }, 0)
    );
  }, 0);

  const duplicateNameCount = (() => {
    const names = new Map<string, number>();
    analysis.campaigns.forEach((c) =>
      names.set(c.name, (names.get(c.name) || 0) + 1),
    );
    let dupes = 0;
    names.forEach((count) => {
      if (count > 1) dupes += count;
    });
    return dupes;
  })();

  const complianceErrorCount = adCopyErrorCount + duplicateNameCount;

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header Panel */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm shrink-0">
        {/* Title row */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-slate-900">
                {analysis.siteName} Structure
              </h2>
              {isGenerating && (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold uppercase rounded-full animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Generating Live
                </span>
              )}
              {isFixing && (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold uppercase rounded-full animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Rewriting {complianceErrorCount} items
                </span>
              )}
            </div>
            <p className="text-slate-500 mt-1">{analysis.structureSummary}</p>
          </div>
        </div>

        {/* Toolbar row */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {/* Left: view controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className={`px-3 py-1.5 rounded-lg border transition flex items-center gap-2 text-xs font-medium
                ${showDebug ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}
              `}
            >
              <Terminal className="w-3.5 h-3.5" />
              {showDebug ? "Hide Agent" : "Live Agent"}
            </button>

            <div className="bg-slate-100 p-0.5 rounded-lg flex items-center">
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-md transition ${viewMode === "table" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                title="Table View"
              >
                <Table className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("detail")}
                className={`p-1.5 rounded-md transition ${viewMode === "detail" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                title="Detail View"
              >
                <LayoutList className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("logs")}
                className={`p-1.5 rounded-md transition ${viewMode === "logs" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                title="AI Logs"
              >
                <History className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onReset}
              className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-white transition flex items-center gap-1.5 text-xs font-medium disabled:opacity-50"
              disabled={isGenerating || isFixing}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              New Project
            </button>

            {onRescan && (
              <button
                onClick={onRescan}
                className="px-3 py-1.5 border border-emerald-200 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition flex items-center gap-1.5 text-xs font-medium text-emerald-700 disabled:opacity-50"
                disabled={isGenerating || isFixing}
              >
                <ScanSearch className="w-3.5 h-3.5" />
                Add Pages
              </button>
            )}

            {onFixCompliance && (
              <button
                onClick={onFixCompliance}
                className={`px-3 py-1.5 text-white rounded-lg transition flex items-center gap-1.5 text-xs font-medium disabled:bg-slate-300 disabled:cursor-not-allowed ${complianceErrorCount > 0 ? "bg-purple-600 hover:bg-purple-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
                disabled={
                  isGenerating || isFixing || complianceErrorCount === 0
                }
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {complianceErrorCount > 0 ? (
                  <>
                    Fix Compliance
                    <span className="bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {complianceErrorCount}
                    </span>
                  </>
                ) : (
                  "Compliant"
                )}
              </button>
            )}

            <button
              onClick={handleExport}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-1.5 text-xs font-medium disabled:bg-slate-300 disabled:cursor-not-allowed"
              disabled={
                isGenerating || isFixing || analysis.campaigns.length === 0
              }
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>

            <div className="border-l border-slate-200 pl-2 flex items-center gap-2">
              <GoogleAdsConnect
                status={googleAds.status}
                loading={googleAds.loading}
                onDisconnect={googleAds.disconnect}
                onSelectAccount={googleAds.selectAccount}
                onRefresh={googleAds.refresh}
              />
              {googleAds.status.connected &&
                googleAds.status.selectedCustomerId && (
                  <GoogleAdsUpload
                    campaigns={analysis.campaigns}
                    disabled={
                      isGenerating ||
                      isFixing ||
                      analysis.campaigns.length === 0
                    }
                    onUploaded={onCampaignsUploaded}
                  />
                )}
            </div>
          </div>
        </div>

        {/* Live Agent Inspector */}
        {showDebug && debugInfo && (
          <div className="mt-4 bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${isGenerating ? "bg-green-400 animate-pulse" : "bg-slate-500"}`}
                ></div>
                <span className="text-xs font-mono font-bold text-slate-300 uppercase">
                  Live Agent: {debugInfo.model}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <span
                  className={`px-2 py-0.5 rounded ${debugInfo.step === "FETCHING_PAGE" ? "bg-blue-900 text-blue-200" : ""}`}
                >
                  SCRAPE
                </span>
                <ChevronRight className="w-3 h-3" />
                <span
                  className={`px-2 py-0.5 rounded ${debugInfo.step === "GENERATING_KEYWORDS" ? "bg-purple-900 text-purple-200" : ""}`}
                >
                  KEYWORDS
                </span>
                <ChevronRight className="w-3 h-3" />
                <span
                  className={`px-2 py-0.5 rounded ${debugInfo.step === "GENERATING_ADS" ? "bg-amber-900 text-amber-200" : ""}`}
                >
                  ADS
                </span>
                <ChevronRight className="w-3 h-3" />
                <span
                  className={`px-2 py-0.5 rounded ${debugInfo.step === "PARSING_JSON" ? "bg-emerald-900 text-emerald-200" : ""}`}
                >
                  OUTPUT
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 divide-x divide-slate-800 text-xs font-mono">
              <div className="p-3 bg-slate-900/50">
                <div className="text-slate-500 font-bold mb-2 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> SOURCE
                </div>
                <div className="text-slate-400 h-24 overflow-y-auto break-all">
                  <div className="mb-1 text-blue-400">
                    {debugInfo.targetUrl}
                  </div>
                  {debugInfo.extractedContentSnippet ? (
                    <div className="whitespace-pre-wrap opacity-70">
                      {debugInfo.extractedContentSnippet}
                    </div>
                  ) : (
                    <span className="italic opacity-30">
                      Waiting for content...
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 bg-slate-900/50">
                <div className="text-slate-500 font-bold mb-2 flex items-center gap-1">
                  <Cpu className="w-3 h-3" /> PROMPT
                </div>
                <div className="text-slate-300 h-24 overflow-y-auto whitespace-pre-wrap">
                  {debugInfo.promptSnippet ? (
                    debugInfo.promptSnippet.slice(0, 400) + "..."
                  ) : (
                    <span className="italic opacity-30">
                      Preparing prompt...
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 bg-slate-900/50">
                <div className="text-slate-500 font-bold mb-2 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> RETURN
                </div>
                <div className="text-emerald-400 h-24 overflow-y-auto whitespace-pre-wrap">
                  {debugInfo.rawResponse ? (
                    debugInfo.rawResponse.slice(0, 500) +
                    (debugInfo.rawResponse.length > 500 ? "..." : "")
                  ) : (
                    <span className="italic opacity-30">
                      Waiting for response...
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {isGenerating && progress && (
          <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex justify-between text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
              <span>Building Campaign Hierarchy...</span>
              <span>
                {progress.current} of {progress.total} Campaigns
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-400 mt-2 text-right">
              {progressPercentage}% Complete
            </p>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0">
        {viewMode === "logs" ? (
          <div className="h-full overflow-hidden bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col p-6">
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                AI Prompt History
              </h3>
              <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                {aiHistory.length} Events
              </span>
            </div>

            <div className="overflow-auto flex-1 border border-slate-100 rounded-xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase font-bold">
                  <tr>
                    <th className="p-3 w-20">Status</th>
                    <th className="p-3 w-24">Time</th>
                    <th className="p-3">Target URL</th>
                    <th className="p-3 w-32">Response Size</th>
                    <th className="p-3 w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {aiHistory.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-8 text-center text-slate-400 italic"
                      >
                        No AI events recorded yet.
                      </td>
                    </tr>
                  )}
                  {aiHistory.map((log) => (
                    <React.Fragment key={log.id}>
                      <tr
                        className={`hover:bg-slate-50 transition ${selectedLogId === log.id ? "bg-blue-50/50" : ""}`}
                      >
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.step === "ERROR" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
                          >
                            {log.step === "ERROR" ? "FAILED" : "SUCCESS"}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-xs text-slate-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="p-3">
                          <div className="truncate max-w-md text-blue-600 font-medium">
                            {log.targetUrl}
                          </div>
                        </td>
                        <td className="p-3 font-mono text-xs text-slate-500">
                          {log.rawResponse
                            ? `${(log.rawResponse.length / 1024).toFixed(1)} KB`
                            : "0 KB"}
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() =>
                              setSelectedLogId(
                                selectedLogId === log.id ? null : log.id,
                              )
                            }
                            className="text-blue-600 hover:text-blue-800 text-xs font-bold underline"
                          >
                            {selectedLogId === log.id ? "Close" : "View Data"}
                          </button>
                        </td>
                      </tr>
                      {selectedLogId === log.id && (
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <td colSpan={5} className="p-0">
                            <div className="grid grid-cols-2 divide-x divide-slate-200">
                              <div className="p-4">
                                <div className="flex items-center gap-2 mb-2 font-bold text-xs text-slate-500 uppercase">
                                  <Cpu className="w-3 h-3" /> Full Prompt
                                </div>
                                <div className="bg-white border border-slate-200 rounded p-3 text-xs font-mono text-slate-600 h-64 overflow-y-auto whitespace-pre-wrap">
                                  {log.fullPrompt || log.promptSnippet}
                                </div>
                              </div>
                              <div className="p-4">
                                <div className="flex items-center gap-2 mb-2 font-bold text-xs text-slate-500 uppercase">
                                  <FileJson className="w-3 h-3" /> Raw JSON
                                  Response
                                </div>
                                <div className="bg-white border border-slate-200 rounded p-3 text-xs font-mono text-emerald-600 h-64 overflow-y-auto whitespace-pre-wrap">
                                  {log.rawResponse}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : viewMode === "table" ? (
          <div className="h-full overflow-hidden bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col">
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Campaign
                    </th>
                    <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Ad Group
                    </th>
                    <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider w-1/4">
                      Keywords
                    </th>
                    <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider w-1/4">
                      Ad Copy Preview (RSA)
                    </th>
                    <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Landing Page
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analysis.campaigns.map((camp) => (
                    <React.Fragment key={camp.id}>
                      {camp.adGroups?.map((group, gIdx) => {
                        const keywords = group.keywords || [];
                        const headlines = group.headlines || [];
                        const descriptions = group.descriptions || [];

                        return (
                          <tr
                            key={group.id}
                            className="hover:bg-slate-50 transition"
                          >
                            <td className="py-4 px-6 align-top">
                              {gIdx === 0 && (
                                <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                  {camp.name}
                                  {camp.language && (
                                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold uppercase">
                                      {camp.language}
                                    </span>
                                  )}
                                  {camp.uploaded && (
                                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">
                                      Pushed
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-4 px-6 align-top">
                              <div className="font-medium text-slate-700 text-sm flex items-center gap-2">
                                <Zap
                                  className={`w-3 h-3 ${group.isDSA ? "text-purple-500" : "text-amber-500"}`}
                                />
                                {group.name}
                                {group.isDSA && (
                                  <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">
                                    DSA
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-6 align-top">
                              {group.isDSA ? (
                                <span className="text-[10px] text-purple-500 italic">
                                  Auto-targeted by Google
                                </span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {keywords.slice(0, 4).map((kw, k) => (
                                    <span
                                      key={k}
                                      className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 whitespace-nowrap"
                                    >
                                      {kw}
                                    </span>
                                  ))}
                                  {keywords.length > 4 && (
                                    <span className="text-[10px] text-slate-400 px-1">
                                      +{keywords.length - 4} more
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-4 px-6 align-top">
                              <div className="space-y-1">
                                {group.isDSA ? (
                                  <>
                                    <p className="text-[10px] text-purple-400 italic mb-1">
                                      Headlines auto-generated by Google
                                    </p>
                                    {descriptions.map((d, i) => (
                                      <p
                                        key={i}
                                        className={`text-xs truncate max-w-[250px] ${d.length > 90 ? "text-red-600 font-bold" : "text-slate-500"}`}
                                        title={
                                          d.length > 90
                                            ? `Too long (${d.length} chars): ${d}`
                                            : d
                                        }
                                      >
                                        {d}
                                      </p>
                                    ))}
                                  </>
                                ) : (
                                  <>
                                    {headlines.map((h, i) => (
                                      <p
                                        key={i}
                                        className={`text-xs truncate max-w-[250px] ${i === 0 ? "font-semibold" : "opacity-75"} ${h.length > 30 ? "text-red-600 font-bold" : "text-blue-700"}`}
                                        title={
                                          h.length > 30
                                            ? `Too long (${h.length} chars): ${h}`
                                            : h
                                        }
                                      >
                                        {h}
                                      </p>
                                    ))}

                                    <div className="my-2 border-t border-slate-100" />

                                    {descriptions.map((d, i) => (
                                      <p
                                        key={i}
                                        className={`text-xs truncate max-w-[250px] ${d.length > 90 ? "text-red-600 font-bold" : "text-slate-500"}`}
                                        title={
                                          d.length > 90
                                            ? `Too long (${d.length} chars): ${d}`
                                            : d
                                        }
                                      >
                                        {d}
                                      </p>
                                    ))}
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-6 align-top">
                              <a
                                href={group.landingPageUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-slate-400 hover:text-blue-500 truncate max-w-[150px] block flex items-center gap-1"
                              >
                                {group.landingPageUrl
                                  ? new URL(group.landingPageUrl).pathname ||
                                    "/"
                                  : "-"}
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}

                  {isGenerating && progress?.currentEntity && (
                    <tr className="bg-slate-50/50 animate-pulse border-l-4 border-l-blue-500">
                      <td className="py-4 px-6 align-top">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                          <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                          {progress.currentEntity}
                        </div>
                      </td>
                      <td className="py-4 px-6 align-top">
                        <div className="h-3 bg-slate-200 rounded w-24"></div>
                      </td>
                      <td className="py-4 px-6 align-top">
                        <div className="flex gap-1">
                          <div className="h-4 bg-slate-200 rounded w-12"></div>
                          <div className="h-4 bg-slate-200 rounded w-16"></div>
                          <div className="h-4 bg-slate-200 rounded w-10"></div>
                        </div>
                      </td>
                      <td className="py-4 px-6 align-top">
                        <div className="space-y-2">
                          <div className="h-3 bg-slate-200 rounded w-32"></div>
                          <div className="h-2 bg-slate-200 rounded w-40"></div>
                        </div>
                      </td>
                      <td className="py-4 px-6 align-top">
                        <div className="h-3 bg-slate-200 rounded w-20"></div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Detail view */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
            <div className="lg:col-span-4 space-y-4 flex flex-col h-full">
              <div className="flex items-center justify-between shrink-0">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                  Campaigns
                </h3>
                <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {analysis.campaigns.length}
                </span>
              </div>

              <div className="space-y-3 overflow-y-auto pr-2 flex-1">
                {analysis.campaigns.map((camp) => (
                  <button
                    key={camp.id}
                    onClick={() => setExpandedCampaign(camp.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      expandedCampaign === camp.id
                        ? "border-blue-500 bg-blue-50 shadow-md"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
                      {camp.name}
                      {camp.language && (
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold uppercase">
                          {camp.language}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {camp.adGroups.length} ad groups &middot; {camp.objective}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl shadow-sm p-6 overflow-y-auto">
              {expandedCampaign ? (
                (() => {
                  const camp = analysis.campaigns.find(
                    (c) => c.id === expandedCampaign,
                  );
                  if (!camp) return null;
                  return (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                          {camp.name}
                          {camp.language && (
                            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold uppercase">
                              {camp.languageDisplay || camp.language}
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-slate-500">
                          Objective: {camp.objective} &middot;{" "}
                          {camp.adGroups.length} Ad Groups
                        </p>
                      </div>
                      {camp.adGroups.map((group) => (
                        <div
                          key={group.id}
                          className="border border-slate-100 rounded-xl p-4 space-y-3"
                        >
                          <div className="flex items-center gap-2">
                            <Zap
                              className={`w-4 h-4 ${group.isDSA ? "text-purple-500" : "text-amber-500"}`}
                            />
                            <h4 className="font-bold text-sm text-slate-800">
                              {group.name}
                            </h4>
                            {group.isDSA && (
                              <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">
                                DSA
                              </span>
                            )}
                          </div>

                          {!group.isDSA && group.keywords.length > 0 && (
                            <div>
                              <p className="text-xs font-bold text-slate-500 mb-1">
                                Keywords
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {group.keywords.map((kw, i) => (
                                  <span
                                    key={i}
                                    className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100"
                                  >
                                    {kw}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {group.headlines.length > 0 && (
                            <div>
                              <p className="text-xs font-bold text-slate-500 mb-1">
                                Headlines
                              </p>
                              {group.headlines.map((h, i) => (
                                <p
                                  key={i}
                                  className={`text-sm ${h.length > 30 ? "text-red-600" : "text-slate-700"}`}
                                >
                                  {h}{" "}
                                  <span className="text-[10px] text-slate-400">
                                    ({h.length}/30)
                                  </span>
                                </p>
                              ))}
                            </div>
                          )}

                          {group.descriptions.length > 0 && (
                            <div>
                              <p className="text-xs font-bold text-slate-500 mb-1">
                                Descriptions
                              </p>
                              {group.descriptions.map((d, i) => (
                                <p
                                  key={i}
                                  className={`text-sm ${d.length > 90 ? "text-red-600" : "text-slate-700"}`}
                                >
                                  {d}{" "}
                                  <span className="text-[10px] text-slate-400">
                                    ({d.length}/90)
                                  </span>
                                </p>
                              ))}
                            </div>
                          )}

                          <div className="text-xs text-slate-400">
                            Landing:{" "}
                            <a
                              href={group.landingPageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-500 hover:underline"
                            >
                              {group.landingPageUrl}
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">
                  Select a campaign to view details
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
