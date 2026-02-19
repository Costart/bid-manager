"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Link2,
  Unlink,
  ChevronDown,
  Loader2,
  CheckCircle,
} from "lucide-react";
import type {
  GoogleAdsStatus,
  GoogleAdsAccount,
} from "@/lib/hooks/use-google-ads";

interface GoogleAdsConnectProps {
  status: GoogleAdsStatus;
  loading: boolean;
  onDisconnect: () => Promise<void>;
  onSelectAccount: (id: string, name: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export default function GoogleAdsConnect({
  status,
  loading,
  onDisconnect,
  onSelectAccount,
  onRefresh,
}: GoogleAdsConnectProps) {
  const [connecting, setConnecting] = useState(false);
  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "google-ads-connected") {
        setConnecting(false);
        onRefresh();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onRefresh]);

  useEffect(() => {
    if (status.connected && !status.selectedCustomerId && !loadingAccounts) {
      fetchAccounts();
    }
  }, [status.connected, status.selectedCustomerId]);

  const fetchAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const res = await fetch("/api/google-ads/accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
        setShowAccountPicker(true);
      }
    } catch {
      // ignore
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch("/api/google-ads/auth");
      if (!res.ok) {
        setConnecting(false);
        return;
      }
      const data = await res.json();
      window.open(data.url, "google-ads-auth", "width=500,height=700");
    } catch {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    await onDisconnect();
    setAccounts([]);
    setShowAccountPicker(false);
    setDisconnecting(false);
  };

  const handleSelectAccount = async (account: GoogleAdsAccount) => {
    await onSelectAccount(account.id, account.name);
    setShowAccountPicker(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Checking Google Ads...</span>
      </div>
    );
  }

  if (!status.connected) {
    return (
      <button
        onClick={handleConnect}
        disabled={connecting}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
      >
        {connecting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Link2 className="w-3.5 h-3.5" />
        )}
        {connecting ? "Connecting..." : "Connect Google Ads"}
      </button>
    );
  }

  if (!status.selectedCustomerId) {
    return (
      <div className="relative flex items-center gap-2">
        <button
          onClick={() =>
            showAccountPicker ? setShowAccountPicker(false) : fetchAccounts()
          }
          disabled={loadingAccounts}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200 transition-colors"
        >
          {loadingAccounts ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
          Select Account
        </button>
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="p-1.5 rounded-lg text-slate-500 hover:text-red-500 hover:bg-slate-100 transition-colors"
          title="Disconnect Google Ads"
        >
          <Unlink className="w-3.5 h-3.5" />
        </button>

        {showAccountPicker && accounts.length > 0 && (
          <div className="absolute top-full mt-1 right-0 z-50 w-72 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100">
              <p className="text-xs text-slate-500">{status.googleEmail}</p>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => handleSelectAccount(acc)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors"
                >
                  <p className="text-sm text-slate-800">{acc.name}</p>
                  <p className="text-xs text-slate-400">
                    {acc.id.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")} &middot;{" "}
                    {acc.currencyCode}
                  </p>
                </button>
              ))}
            </div>
            <div className="px-3 py-2 border-t border-slate-100">
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-xs text-red-500 hover:text-red-600"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}

        {showAccountPicker && accounts.length === 0 && !loadingAccounts && (
          <div className="absolute top-full mt-1 right-0 z-50 w-72 bg-white border border-slate-200 rounded-lg shadow-xl p-3">
            <p className="text-xs text-slate-500">
              No Google Ads accounts found. Make sure your Google account has
              access to a Google Ads account.
            </p>
            <button
              onClick={handleDisconnect}
              className="mt-2 text-xs text-red-500 hover:text-red-600"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200">
        <CheckCircle className="w-3 h-3 text-emerald-600" />
        <span className="text-xs text-emerald-700 font-medium">
          {status.selectedCustomerName}
        </span>
      </div>
      <button
        onClick={handleDisconnect}
        disabled={disconnecting}
        className="p-1.5 rounded-lg text-slate-500 hover:text-red-500 hover:bg-slate-100 transition-colors"
        title="Disconnect Google Ads"
      >
        <Unlink className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
