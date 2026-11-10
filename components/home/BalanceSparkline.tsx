"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/finance/format";

type Point = { date: string; balance: number };

const WIDTH = 320;
const HEIGHT = 56;

/**
 * Linha do saldo em conta nos últimos 30 dias (tela inicial). O último
 * ponto é o saldo mostrado agora (com notificações e correções), não só a
 * última foto do banco.
 */
export function BalanceSparkline({
  connectionId,
  currentBalance,
  todayKey,
  hidden,
}: {
  connectionId: string;
  currentBalance: number;
  todayKey: string;
  hidden: boolean;
}) {
  const [loaded, setLoaded] = useState<{ key: string; history: Point[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/bank/history?banco=${encodeURIComponent(connectionId)}&dias=30`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { history: [] }))
      .then((data: { history?: Point[] }) => {
        if (!cancelled) setLoaded({ key: connectionId, history: data.history ?? [] });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key: connectionId, history: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [connectionId]);

  const history = loaded?.key === connectionId ? loaded.history : null;
  if (!history) return <div className="mt-5 h-[72px]" aria-hidden />;

  const points = [...history.filter((point) => point.date < todayKey), { date: todayKey, balance: currentBalance }];
  if (points.length < 3) return null;

  const values = points.map((point) => point.balance);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = WIDTH / (points.length - 1);
  const coords = points.map((point, index) => [index * step, HEIGHT - 4 - ((point.balance - min) / range) * (HEIGHT - 8)]);
  const line = coords.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`;

  const change = currentBalance - points[0].balance;
  const up = change >= 0;
  const stroke = up ? "#34d399" : "#fb7185";

  return (
    <figure className="mt-5" aria-label={`Saldo em conta nos últimos ${points.length} dias`}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="h-14 w-full max-w-md" aria-hidden>
        <defs>
          <linearGradient id="sparkline-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#sparkline-fill)" />
        <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="mt-1 text-xs text-zinc-500">
        Saldo em conta ·{" "}
        <span className={up ? "text-emerald-400" : "text-rose-300"}>
          {hidden ? "••••" : `${up ? "+" : "−"}${formatCurrency(Math.abs(change))}`}
        </span>{" "}
        em {points.length} dias
      </figcaption>
    </figure>
  );
}
