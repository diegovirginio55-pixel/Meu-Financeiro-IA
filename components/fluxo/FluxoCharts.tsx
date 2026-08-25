"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
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
import { formatCurrency } from "@/lib/finance/format";
import { categoryColor } from "@/lib/finance/categories";
import { chartTooltipStyle, compactAxis } from "@/components/dashboard/chart-theme";

export function FluxoAreaChart({
  data,
}: {
  data: { dia: string; entradas: number; despesas: number }[];
}) {
  const uid = useId().replace(/:/g, "");

  return (
    <div className="h-[280px] w-full lg:h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id={`fluxoIn-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.38} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`fluxoOut-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fb7185" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#fb7185" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#27272a" strokeDasharray="4 8" vertical={false} />
          <XAxis
            dataKey="dia"
            stroke="#71717a"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            dy={8}
          />
          <YAxis
            stroke="#71717a"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={72}
            tickFormatter={compactAxis}
          />
          <Tooltip
            contentStyle={chartTooltipStyle}
            formatter={(value, name) => [
              formatCurrency(Number(value)),
              name === "entradas" ? "Entradas" : "Despesas",
            ]}
          />
          <Legend
            verticalAlign="top"
            height={28}
            formatter={(value) => (value === "entradas" ? "Entradas" : "Despesas")}
            wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }}
          />
          <Area
            type="monotone"
            dataKey="entradas"
            stroke="#34d399"
            strokeWidth={2.4}
            fill={`url(#fluxoIn-${uid})`}
            dot={false}
            activeDot={{ r: 5, fill: "#34d399", stroke: "#09090b", strokeWidth: 2 }}
          />
          <Area
            type="monotone"
            dataKey="despesas"
            stroke="#fb7185"
            strokeWidth={2.4}
            fill={`url(#fluxoOut-${uid})`}
            dot={false}
            activeDot={{ r: 5, fill: "#fb7185", stroke: "#09090b", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FluxoDonutChart({
  data,
}: {
  data: { category: string; total: number }[];
}) {
  if (data.length === 0) {
    return (
      <p className="flex h-[220px] items-center justify-center text-sm text-zinc-500 lg:h-[360px]">
        Sem despesas neste período.
      </p>
    );
  }

  const top = data.slice(0, 5);
  const restTotal = data.slice(5).reduce((sum, item) => sum + item.total, 0);
  const slices = restTotal > 0 ? [...top, { category: "Demais", total: restTotal }] : top;
  const grand = slices.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="flex h-[240px] items-center gap-2 lg:h-[360px]">
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
      <ul className="hidden w-[42%] max-w-[180px] shrink-0 space-y-2.5 pr-1 sm:block">
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
