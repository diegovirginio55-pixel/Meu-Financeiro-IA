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
  LabelList,
} from "recharts";
import { formatCurrency, formatMonthLabel } from "@/lib/finance/format";
import { barMoneyLabel, chartTooltipStyle } from "@/components/dashboard/chart-theme";

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
        <BarChart data={chartData} margin={{ top: 24, right: 8, left: 4, bottom: 0 }}>
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
          <Bar dataKey="Entradas" fill="#10b981" radius={[6, 6, 0, 0]}>
            <LabelList dataKey="Entradas" position="top" formatter={barMoneyLabel} fill="#d4d4d8" fontSize={9} offset={4} />
          </Bar>
          <Bar dataKey="Despesas" fill="#ef4444" radius={[6, 6, 0, 0]}>
            <LabelList dataKey="Despesas" position="top" formatter={barMoneyLabel} fill="#d4d4d8" fontSize={9} offset={4} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
