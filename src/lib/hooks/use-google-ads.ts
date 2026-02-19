"use client";

import { useState, useEffect, useCallback } from "react";

export interface GoogleAdsStatus {
  connected: boolean;
  googleEmail?: string;
  selectedCustomerId?: string;
  selectedCustomerName?: string;
}

export interface GoogleAdsAccount {
  id: string;
  name: string;
  currencyCode: string;
}

export function useGoogleAdsStatus() {
  const [status, setStatus] = useState<GoogleAdsStatus>({ connected: false });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/google-ads/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      } else {
        setStatus({ connected: false });
      }
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const disconnect = useCallback(async () => {
    try {
      const res = await fetch("/api/google-ads/status", { method: "DELETE" });
      if (res.ok) {
        setStatus({ connected: false });
      }
    } catch {
      // ignore
    }
  }, []);

  const selectAccount = useCallback(
    async (customerId: string, customerName: string) => {
      try {
        const res = await fetch("/api/google-ads/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId, customerName }),
        });
        if (res.ok) {
          setStatus((prev) => ({
            ...prev,
            selectedCustomerId: customerId,
            selectedCustomerName: customerName,
          }));
        }
      } catch {
        // ignore
      }
    },
    [],
  );

  return { status, loading, disconnect, selectAccount, refresh };
}
