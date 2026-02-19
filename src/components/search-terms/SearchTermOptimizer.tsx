"use client";

import { useState, useMemo, useCallback } from "react";
import { useGoogleAdsStatus } from "@/lib/hooks/use-google-ads";
import { useMicrosoftAdsStatus } from "@/lib/hooks/use-microsoft-ads";
import GoogleAdsConnect from "@/components/ad-builder/GoogleAdsConnect";
import {
  calculateSearchTermBids,
  calculateAdGroupBids,
} from "@/lib/bid-engine/search-term-bids";
import { exportSearchTermsCsv } from "@/lib/bid-engine/search-term-exporter";
import type {
  SearchTermResult,
  AdGroupBidSuggestion,
} from "@/lib/bid-engine/types";
import {
  Download,
  Loader2,
  Search,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  DollarSign,
  Target,
  BarChart3,
  Upload,
  Link2,
  Unlink,
  CheckCircle,
} from "lucide-react";

const DATE_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
];

interface MsAccount {
  id: string;
  name: string;
  customerId: string;
}

export default function SearchTermOptimizer() {
  const googleAds = useGoogleAdsStatus();
  const msAds = useMicrosoftAdsStatus();

  const [terms, setTerms] = useState<SearchTermResult[]>([]);
  const [adGroupBids, setAdGroupBids] = useState<AdGroupBidSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  // Microsoft Ads
  const [msAccounts, setMsAccounts] = useState<MsAccount[]>([]);
  const [loadingMsAccounts, setLoadingMsAccounts] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<string | null>(null);

  // Settings
  const [days, setDays] = useState(30);
  const [profitMargin, setProfitMargin] = useState(0.3);
  const [bidFloor, setBidFloor] = useState(0.1);
  const [bidCap, setBidCap] = useState(50.0);

  // Filters
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [selectedAdGroup, setSelectedAdGroup] = useState("");
  const [searchFilter, setSearchFilter] = useState("");

  // View
  const [viewMode, setViewMode] = useState<"terms" | "adgroups">("terms");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const params = useMemo(
    () => ({ profitMargin, bidFloor, bidCap }),
    [profitMargin, bidFloor, bidCap],
  );

  const fetchTerms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/google-ads/search-terms?days=${days}&conversionsOnly=true`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch search terms");
      }
      const data = await res.json();
      const raw: SearchTermResult[] = data.results || [];
      const withBids = calculateSearchTermBids(raw, params).map((t) => ({
        ...t,
        selected: true,
      }));
      setTerms(withBids);
      setAdGroupBids(calculateAdGroupBids(withBids));
      setFetched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [days, params]);

  const recalculate = useCallback(() => {
    const recalced = calculateSearchTermBids(terms, params);
    setTerms(recalced);
    setAdGroupBids(calculateAdGroupBids(recalced));
  }, [terms, params]);

  const toggleSelect = (index: number) => {
    setTerms((prev) =>
      prev.map((t, i) => (i === index ? { ...t, selected: !t.selected } : t)),
    );
  };

  const selectAll = () =>
    setTerms((prev) => prev.map((t) => ({ ...t, selected: true })));
  const deselectAll = () =>
    setTerms((prev) => prev.map((t) => ({ ...t, selected: false })));

  const filteredTerms = useMemo(() => {
    let result = terms;
    if (selectedCampaign)
      result = result.filter((t) => t.campaign === selectedCampaign);
    if (selectedAdGroup)
      result = result.filter((t) => t.adGroup === selectedAdGroup);
    if (searchFilter) {
      const lower = searchFilter.toLowerCase();
      result = result.filter((t) => t.searchTerm.toLowerCase().includes(lower));
    }
    return result;
  }, [terms, selectedCampaign, selectedAdGroup, searchFilter]);

  const selectedTerms = useMemo(() => terms.filter((t) => t.selected), [terms]);

  const campaigns = useMemo(
    () => [...new Set(terms.map((t) => t.campaign))].sort(),
    [terms],
  );
  const adGroups = useMemo(() => {
    const source = selectedCampaign
      ? terms.filter((t) => t.campaign === selectedCampaign)
      : terms;
    return [...new Set(source.map((t) => t.adGroup))].sort();
  }, [terms, selectedCampaign]);

  const stats = useMemo(() => {
    const s = selectedTerms;
    return {
      count: s.length,
      totalConversions: s.reduce((sum, t) => sum + t.conversions, 0),
      totalValue: s.reduce((sum, t) => sum + t.conversionValue, 0),
      avgBid:
        s.length > 0
          ? s.reduce((sum, t) => sum + (t.suggestedBid || 0), 0) / s.length
          : 0,
    };
  }, [selectedTerms]);

  const handleExport = () => {
    if (selectedTerms.length === 0) return;
    const csv = exportSearchTermsCsv(selectedTerms);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "microsoft_ads_search_terms.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const fetchMsAccounts = useCallback(async () => {
    setLoadingMsAccounts(true);
    setError(null);
    try {
      const res = await fetch("/api/microsoft-ads/accounts");
      const data = await res.json();
      if (res.ok) {
        setMsAccounts(data.accounts || []);
      } else {
        if (
          res.status === 401 ||
          (data.error && data.error.includes("Session expired"))
        ) {
          setError("Microsoft Ads session expired. Please reconnect.");
        } else {
          setError(`Microsoft Ads: ${data.error || "Failed to load accounts"}`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
    } finally {
      setLoadingMsAccounts(false);
    }
  }, []);

  const handlePushToMicrosoft = async () => {
    if (selectedTerms.length === 0) return;
    setPushing(true);
    setPushResult(null);
    setError(null);

    try {
      // For now, export as CSV since direct push requires matching ad group IDs
      // between Google Ads and Microsoft Ads campaign structures
      const csv = exportSearchTermsCsv(selectedTerms);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "microsoft_ads_keywords.csv";
      a.click();
      URL.revokeObjectURL(url);
      setPushResult(
        `Exported ${selectedTerms.length} keywords for Microsoft Ads import.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Push failed");
    } finally {
      setPushing(false);
    }
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isConnected =
    googleAds.status.connected && googleAds.status.selectedCustomerId;

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <aside className="w-72 shrink-0 space-y-4">
        {/* Connection */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-slate-700">Google Ads</h3>
          <GoogleAdsConnect
            status={googleAds.status}
            loading={googleAds.loading}
            onDisconnect={googleAds.disconnect}
            onSelectAccount={googleAds.selectAccount}
            onRefresh={googleAds.refresh}
          />
        </div>

        {/* Microsoft Ads Connection */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-slate-700">Microsoft Ads</h3>
          {msAds.loading ? (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading...
            </div>
          ) : msAds.status.connected ? (
            <div className="space-y-2">
              {msAds.status.accountId ? (
                <div className="flex items-center gap-2 text-xs">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-slate-700 font-medium">
                    {msAds.status.accountName || msAds.status.accountId}
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">Select an account:</p>
                  {msAccounts.length === 0 ? (
                    <button
                      onClick={fetchMsAccounts}
                      disabled={loadingMsAccounts}
                      className="w-full px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {loadingMsAccounts ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        "Load Accounts"
                      )}
                    </button>
                  ) : (
                    <div className="space-y-1">
                      {msAccounts.map((acc) => (
                        <button
                          key={acc.id}
                          onClick={() =>
                            msAds.selectAccount(
                              acc.id,
                              acc.name,
                              acc.customerId,
                            )
                          }
                          className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-blue-50 rounded-lg text-xs transition border border-slate-100 hover:border-blue-200"
                        >
                          <div className="font-medium text-slate-700">
                            {acc.name}
                          </div>
                          <div className="text-slate-400">ID: {acc.id}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={msAds.disconnect}
                className="w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition flex items-center justify-center gap-1.5"
              >
                <Unlink className="w-3 h-3" /> Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={msAds.connect}
              className="w-full px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition flex items-center justify-center gap-1.5 border border-blue-200"
            >
              <Link2 className="w-3.5 h-3.5" /> Connect Microsoft Ads
            </button>
          )}
        </div>

        {/* Date Range */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-slate-700">Date Range</h3>
          <div className="flex gap-1">
            {DATE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                  days === opt.value
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bid Settings */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-slate-700">Bid Settings</h3>
          <div className="space-y-2">
            <label className="block">
              <span className="text-xs text-slate-500">Profit Margin</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={profitMargin}
                onChange={(e) =>
                  setProfitMargin(parseFloat(e.target.value) || 0)
                }
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">Bid Floor ($)</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={bidFloor}
                onChange={(e) => setBidFloor(parseFloat(e.target.value) || 0)}
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">Bid Cap ($)</span>
              <input
                type="number"
                min={0}
                step={1}
                value={bidCap}
                onChange={(e) => setBidCap(parseFloat(e.target.value) || 0)}
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              />
            </label>
          </div>
          {fetched && (
            <button
              onClick={recalculate}
              className="w-full px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200 transition"
            >
              Recalculate Bids
            </button>
          )}
        </div>

        {/* Fetch Button */}
        <button
          onClick={fetchTerms}
          disabled={!isConnected || loading}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Fetching...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Fetch Search Terms
            </>
          )}
        </button>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {pushResult && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {pushResult}
          </div>
        )}

        {!fetched && !error && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">
              {isConnected
                ? 'Click "Fetch Search Terms" to pull converting search terms from Google Ads.'
                : "Connect your Google Ads account to get started."}
            </p>
          </div>
        )}

        {fetched && terms.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <p className="text-slate-500 text-sm">
              No converting search terms found in the last {days} days.
            </p>
          </div>
        )}

        {fetched && terms.length > 0 && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                  <Target className="w-3.5 h-3.5" /> Selected Terms
                </div>
                <div className="text-xl font-bold text-slate-900">
                  {stats.count}
                  <span className="text-sm font-normal text-slate-400">
                    /{terms.length}
                  </span>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Conversions
                </div>
                <div className="text-xl font-bold text-slate-900">
                  {stats.totalConversions.toFixed(1)}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                  <DollarSign className="w-3.5 h-3.5" /> Conv. Value
                </div>
                <div className="text-xl font-bold text-slate-900">
                  ${stats.totalValue.toFixed(2)}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                  <BarChart3 className="w-3.5 h-3.5" /> Avg Suggested Bid
                </div>
                <div className="text-xl font-bold text-slate-900">
                  ${stats.avgBid.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {/* View toggle */}
                <div className="bg-slate-100 p-0.5 rounded-lg flex items-center">
                  <button
                    onClick={() => setViewMode("terms")}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                      viewMode === "terms"
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Search Terms
                  </button>
                  <button
                    onClick={() => setViewMode("adgroups")}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                      viewMode === "adgroups"
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Ad Group Bids
                  </button>
                </div>

                {/* Filters */}
                <select
                  value={selectedCampaign}
                  onChange={(e) => {
                    setSelectedCampaign(e.target.value);
                    setSelectedAdGroup("");
                  }}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5"
                >
                  <option value="">All Campaigns</option>
                  {campaigns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedAdGroup}
                  onChange={(e) => setSelectedAdGroup(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5"
                >
                  <option value="">All Ad Groups</option>
                  {adGroups.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>

                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter terms..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg pl-7 pr-2 py-1.5 w-40"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={deselectAll}
                  className="text-xs text-slate-500 hover:text-slate-700 font-medium"
                >
                  Deselect All
                </button>

                <button
                  onClick={handleExport}
                  disabled={selectedTerms.length === 0}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV ({selectedTerms.length})
                </button>
              </div>
            </div>

            {/* Content */}
            {viewMode === "terms" ? (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4 w-10"></th>
                        <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">
                          Search Term
                        </th>
                        <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">
                          Campaign
                        </th>
                        <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">
                          Ad Group
                        </th>
                        <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase text-right">
                          Clicks
                        </th>
                        <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase text-right">
                          Conv.
                        </th>
                        <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase text-right">
                          Value
                        </th>
                        <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase text-right">
                          Value/Click
                        </th>
                        <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase text-right">
                          Suggested Bid
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTerms.map((term, idx) => {
                        const globalIdx = terms.indexOf(term);
                        return (
                          <tr
                            key={`${term.searchTerm}-${term.campaign}-${term.adGroup}-${idx}`}
                            className={`hover:bg-slate-50 transition ${term.selected ? "" : "opacity-50"}`}
                          >
                            <td className="py-3 px-4">
                              <button onClick={() => toggleSelect(globalIdx)}>
                                {term.selected ? (
                                  <CheckSquare className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-300" />
                                )}
                              </button>
                            </td>
                            <td className="py-3 px-4 text-sm font-medium text-slate-800">
                              {term.searchTerm}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-500">
                              {term.campaign}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-500">
                              {term.adGroup}
                            </td>
                            <td className="py-3 px-4 text-sm text-right text-slate-700">
                              {term.clicks}
                            </td>
                            <td className="py-3 px-4 text-sm text-right text-slate-700">
                              {term.conversions.toFixed(1)}
                            </td>
                            <td className="py-3 px-4 text-sm text-right text-slate-700">
                              ${term.conversionValue.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-sm text-right text-slate-700">
                              ${term.valuePerClick?.toFixed(2) || "0.00"}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-sm font-bold">
                                ${term.suggestedBid?.toFixed(2) || "0.00"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Ad Group Bids View */
              <div className="space-y-2">
                {adGroupBids
                  .filter(
                    (g) =>
                      (!selectedCampaign || g.campaign === selectedCampaign) &&
                      (!selectedAdGroup || g.adGroup === selectedAdGroup),
                  )
                  .map((group) => {
                    const key = `${group.campaign}|${group.adGroup}`;
                    const isExpanded = expandedGroups.has(key);
                    const groupTerms = terms.filter(
                      (t) =>
                        t.campaign === group.campaign &&
                        t.adGroup === group.adGroup,
                    );
                    return (
                      <div
                        key={key}
                        className="bg-white border border-slate-200 rounded-xl overflow-hidden"
                      >
                        <button
                          onClick={() => toggleGroup(key)}
                          className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition"
                        >
                          <div className="flex items-center gap-3 text-left">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                            <div>
                              <div className="text-sm font-bold text-slate-800">
                                {group.adGroup}
                              </div>
                              <div className="text-xs text-slate-400">
                                {group.campaign}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-right">
                            <div>
                              <div className="text-[10px] text-slate-400 uppercase">
                                Terms
                              </div>
                              <div className="text-sm font-bold text-slate-700">
                                {group.searchTermCount}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-400 uppercase">
                                Conversions
                              </div>
                              <div className="text-sm font-bold text-slate-700">
                                {group.totalConversions.toFixed(1)}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-400 uppercase">
                                Value
                              </div>
                              <div className="text-sm font-bold text-slate-700">
                                ${group.totalValue.toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-400 uppercase">
                                Suggested Bid
                              </div>
                              <div className="text-sm font-bold text-emerald-600">
                                ${group.suggestedBid.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="border-t border-slate-100 px-4 py-2">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="text-slate-400 uppercase">
                                  <th className="py-2 pr-4">Search Term</th>
                                  <th className="py-2 pr-4 text-right">
                                    Clicks
                                  </th>
                                  <th className="py-2 pr-4 text-right">
                                    Conv.
                                  </th>
                                  <th className="py-2 pr-4 text-right">
                                    Value
                                  </th>
                                  <th className="py-2 text-right">Bid</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {groupTerms.map((t, i) => (
                                  <tr key={i} className="text-slate-600">
                                    <td className="py-1.5 pr-4 font-medium">
                                      {t.searchTerm}
                                    </td>
                                    <td className="py-1.5 pr-4 text-right">
                                      {t.clicks}
                                    </td>
                                    <td className="py-1.5 pr-4 text-right">
                                      {t.conversions.toFixed(1)}
                                    </td>
                                    <td className="py-1.5 pr-4 text-right">
                                      ${t.conversionValue.toFixed(2)}
                                    </td>
                                    <td className="py-1.5 text-right font-bold text-emerald-600">
                                      ${t.suggestedBid?.toFixed(2)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
