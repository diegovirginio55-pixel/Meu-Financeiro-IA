"use client";

import { useEffect, useState } from "react";

// O cron roda a cada 10 minutos; se passou muito mais que isso sem rodar,
// algo parou (GitHub Actions desabilitado, secret errado, etc.) e vale
// avisar discretamente na tela.
const STALE_MINUTES = 30;

export function CronHealthBanner() {
  const [staleMinutes, setStaleMinutes] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/system/health", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { lastRunAt?: string | null } | null) => {
        if (!active || !data?.lastRunAt) return;
        const minutes = Math.round((Date.now() - new Date(data.lastRunAt).getTime()) / 60_000);
        if (minutes >= STALE_MINUTES) setStaleMinutes(minutes);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (staleMinutes == null) return null;

  const label = staleMinutes >= 120 ? `há ${Math.round(staleMinutes / 60)}h` : `há ${staleMinutes} min`;

  return (
    <div className="mb-4 rounded-2xl border border-amber-800/50 bg-amber-950/20 px-4 py-2.5 text-xs text-amber-200">
      ⚠️ A sincronização automática não roda {label}. Os dados podem estar atrasados — abra{" "}
      <span className="font-medium">Bancos</span> e sincronize manualmente se precisar.
    </div>
  );
}
