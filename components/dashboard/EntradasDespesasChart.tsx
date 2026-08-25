"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { formatCurrency, formatMonthLabel } from "@/lib/finance/format";
import { chartTooltipStyle } from "@/components/dashboard/chart-theme";

interface Props {
  data: { mes: string; entradas: number; despesas: number }[];
}

export default function EntradasDespesasChart({ data }: Props) {
  const chartData = data.map((d) => ({
    mes: formatMonthLabel(d.mes),
    Entradas: d.entradas,
    Despesas: d.despesas,
  }));

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="mb-4 text-sm font-medium text-zinc-300">
        Entradas x Despesas (últimos 6 meses)
      </h2>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis dataKey="mes" stroke="#71717a" fontSize={12} />
          <YAxis
            stroke="#71717a"
            fontSize={12}
            tickFormatter={(v) => formatCurrency(v).replace(/,\d{2}$/, "")}
            width={80}
          />
          <Tooltip
            contentStyle={chartTooltipStyle}
            formatter={(value) => formatCurrency(Number(value))}
          />
          <Legend />
          <Bar dataKey="Entradas" fill="#10b981" radius={[6, 6, 0, 0]} />
          <Bar dataKey="Despesas" fill="#ef4444" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
