"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "mf-bank-refresh-at";
const MIN_INTERVAL_MS = 30 * 60 * 1000;

export default function AutoBankSync() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const last = Number(window.sessionStorage.getItem(STORAGE_KEY) || 0);
    if (Date.now() - last < MIN_INTERVAL_MS) return;
    window.sessionStorage.setItem(STORAGE_KEY, String(Date.now()));

    void fetch("/api/bank/refresh", { method: "POST" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.updated > 0) router.refresh();
      })
      .catch(() => undefined);
  }, [router]);

  return null;
}
