"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatMonthLabel } from "@/lib/finance/format";
import { categoryColor } from "@/lib/finance/categories";
import { chartTooltipStyle, compactAxis } from "@/components/dashboard/chart-theme";

export function SaldoEvolutionChart({
  data,
}: {
  data: { mes: string; saldo: number; patrimonio: number }[];
}) {
  const uid = useId().replace(/:/g, "");
  const chartData = data.map((item) => ({
    ...item,
    label: formatMonthLabel(item.mes),
  }));

  return (
    <div className="h-[260px] w-full lg:h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id={`saldoFill-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.38} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`patrFill-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#27272a" strokeDasharray="4 8" vertical={false} />
          <XAxis dataKey="label" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} dy={8} />
          <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} width={72} tickFormatter={compactAxis} />
          <Tooltip
            contentStyle={chartTooltipStyle}
            formatter={(value, name) => [
              formatCurrency(Number(value)),
              name === "saldo" ? "Saldo em contas" : "Patrimônio",
            ]}
          />
          <Legend
            verticalAlign="top"
            height={28}
            formatter={(value) => (value === "saldo" ? "Saldo em contas" : "Patrimônio")}
            wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }}
          />
          <Area
            type="monotone"
            dataKey="patrimonio"
            stroke="#60a5fa"
            strokeWidth={2}
            fill={`url(#patrFill-${uid})`}
            dot={false}
            activeDot={{ r: 5, fill: "#60a5fa", stroke: "#09090b", strokeWidth: 2 }}
          />
          <Area
            type="monotone"
            dataKey="saldo"
            stroke="#34d399"
            strokeWidth={2.6}
            fill={`url(#saldoFill-${uid})`}
            dot={false}
            activeDot={{ r: 5, fill: "#34d399", stroke: "#09090b", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FluxoBarrasChart({
  data,
}: {
  data: { mes: string; entradas: number; despesas: number }[];
}) {
  const uid = useId().replace(/:/g, "");
  const chartData = data.map((item) => ({
    mes: formatMonthLabel(item.mes),
    Entradas: item.entradas,
    Despesas: item.despesas,
  }));

  return (
    <div className="h-[260px] w-full lg:h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} barCategoryGap="28%" maxBarSize={28} margin={{ top: 12, right: 8, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id={`inFill-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6ee7b7" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id={`outFill-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fda4af" />
              <stop offset="100%" stopColor="#e11d48" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#27272a" strokeDasharray="4 8" vertical={false} />
          <XAxis dataKey="mes" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} dy={8} />
          <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} width={72} tickFormatter={compactAxis} />
          <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => formatCurrency(Number(value))} />
          <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
          <Bar dataKey="Entradas" fill={`url(#inFill-${uid})`} radius={[8, 8, 2, 2]} />
          <Bar dataKey="Despesas" fill={`url(#outFill-${uid})`} radius={[8, 8, 2, 2]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GastosDonutChart({
  data,
}: {
  data: { category: string; total: number }[];
}) {
  if (data.length === 0) {
    return <p className="flex h-[260px] items-center justify-center text-sm text-zinc-500">Sem despesas neste mês.</p>;
  }

  const top = data.slice(0, 5);
  const restTotal = data.slice(5).reduce((sum, item) => sum + item.total, 0);
  const slices = restTotal > 0 ? [...top, { category: "Demais", total: restTotal }] : top;
  const grand = slices.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="flex h-[260px] items-center gap-2 lg:h-[340px]">
      <div className="h-full min-w-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="total"
              nameKey="category"
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={3}
              stroke="#09090b"
              strokeWidth={3}
            >
              {slices.map((entry) => (
                <Cell key={entry.category} fill={categoryColor(entry.category)} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={chartTooltipStyle}
              formatter={(value, name) => [formatCurrency(Number(value)), name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-[42%] max-w-[180px] shrink-0 space-y-2.5 pr-1">
        {slices.map((item) => (
          <li key={item.category} className="flex items-start gap-2 text-xs">
            <span
              className="mt-1 h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: categoryColor(item.category) }}
            />
            <span className="min-w-0">
              <span className="block truncate text-zinc-200">{item.category}</span>
              <span className="text-zinc-500">
                {grand > 0 ? `${Math.round((item.total / grand) * 100)}%` : "0%"} · {formatCurrency(item.total)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
