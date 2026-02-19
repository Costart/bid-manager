"use client";

import { useState, useEffect, useCallback } from "react";

export interface MicrosoftAdsStatus {
  connected: boolean;
  accountId?: string;
  accountName?: string;
  customerId?: string;
}

export interface MicrosoftAdsAccount {
  id: string;
  name: string;
  customerId: string;
}

export function useMicrosoftAdsStatus() {
  const [status, setStatus] = useState<MicrosoftAdsStatus>({
    connected: false,
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/microsoft-ads/status");
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

  const connect = useCallback(async () => {
    try {
      const res = await fetch("/api/microsoft-ads/auth");
      if (!res.ok) return;
      const data = await res.json();

      const popup = window.open(
        data.url,
        "microsoft-ads-auth",
        "width=600,height=700",
      );

      const handler = (event: MessageEvent) => {
        if (event.data?.type === "microsoft-ads-callback") {
          window.removeEventListener("message", handler);
          refresh();
        } else if (event.data?.type === "microsoft-ads-error") {
          window.removeEventListener("message", handler);
        }
      };
      window.addEventListener("message", handler);

      // Fallback poll in case popup message fails
      const interval = setInterval(() => {
        if (popup?.closed) {
          clearInterval(interval);
          window.removeEventListener("message", handler);
          refresh();
        }
      }, 1000);
    } catch {
      // ignore
    }
  }, [refresh]);

  const disconnect = useCallback(async () => {
    try {
      const res = await fetch("/api/microsoft-ads/status", {
        method: "DELETE",
      });
      if (res.ok) {
        setStatus({ connected: false });
      }
    } catch {
      // ignore
    }
  }, []);

  const selectAccount = useCallback(
    async (accountId: string, accountName: string, customerId: string) => {
      try {
        const res = await fetch("/api/microsoft-ads/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId, accountName, customerId }),
        });
        if (res.ok) {
          setStatus((prev) => ({
            ...prev,
            accountId,
            accountName,
            customerId,
          }));
        }
      } catch {
        // ignore
      }
    },
    [],
  );

  return { status, loading, connect, disconnect, selectAccount, refresh };
}
