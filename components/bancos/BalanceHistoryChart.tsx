"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/finance/format";

interface HistoryPoint {
  date: string;
  balance: number;
}

export function BalanceHistoryChart({ connectionId }: { connectionId: string }) {
  const [history, setHistory] = useState<HistoryPoint[] | null>(null);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reseta ao trocar de conexão antes de buscar de novo
    setHistory(null);
    fetch(`/api/bank/connections/${connectionId}/history`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { history: [] }))
      .then((data: { history?: HistoryPoint[] }) => {
        if (active) setHistory(data.history ?? []);
      })
      .catch(() => {
        if (active) setHistory([]);
      });
    return () => {
      active = false;
    };
  }, [connectionId]);

  if (history == null) {
    return <p className="mt-4 text-xs text-zinc-500">Carregando histórico de saldo…</p>;
  }
  if (history.length < 2) {
    return null;
  }

  return (
    <div className="mt-4">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
        Evolução do saldo
      </p>
      <div className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="balanceHistoryGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tickFormatter={(value: string) => format(parseISO(value), "d/MM", { locale: ptBR })}
              tick={{ fill: "#71717a", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <Tooltip
              contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 12, fontSize: 12 }}
              labelFormatter={(value) =>
                typeof value === "string" ? format(parseISO(value), "d 'de' MMMM", { locale: ptBR }) : ""
              }
              formatter={(value) => [formatCurrency(Number(value)), "Saldo"]}
            />
            <Area type="monotone" dataKey="balance" stroke="#34d399" strokeWidth={2} fill="url(#balanceHistoryGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
