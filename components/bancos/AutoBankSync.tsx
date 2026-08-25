"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "mf-bank-refresh-at";
const MIN_INTERVAL_MS = 10 * 60 * 1000;
const FOLLOW_UP_MS = 50_000;

async function refreshBanks(pullOnly = false) {
  const res = await fetch("/api/bank/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pullOnly }),
  });
  if (!res.ok) return null;
  return (await res.json()) as { pulled?: number; triggered?: number; updated?: number };
}

export default function AutoBankSync() {
  const router = useRouter();
  const followUp = useRef<number | null>(null);

  useEffect(() => {
    function run() {
      const last = Number(window.localStorage.getItem(STORAGE_KEY) || 0);
      if (Date.now() - last < MIN_INTERVAL_MS) return;
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));

      void refreshBanks()
        .then((data) => {
          if (!data) return;
          if ((data.pulled ?? data.updated ?? 0) > 0) router.refresh();
          if ((data.triggered ?? 0) > 0) {
            if (followUp.current) window.clearTimeout(followUp.current);
            followUp.current = window.setTimeout(() => {
              void refreshBanks(true).then((again) => {
                if ((again?.pulled ?? again?.updated ?? 0) > 0) router.refresh();
              });
            }, FOLLOW_UP_MS);
          }
        })
        .catch(() => undefined);
    }

    run();
    function onVisible() {
      if (document.visibilityState === "visible") run();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (followUp.current) window.clearTimeout(followUp.current);
    };
  }, [router]);

  return null;
}
