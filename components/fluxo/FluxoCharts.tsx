"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/finance/format";
import { categoryColor } from "@/lib/finance/categories";

const tooltipStyle = {
  background: "#141414",
  border: "1px solid #27272a",
  borderRadius: 12,
  fontSize: 12,
};

export function FluxoAreaChart({
  data,
}: {
  data: { dia: string; entradas: number; despesas: number }[];
}) {
  return (
    <div className="h-[280px] w-full lg:h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fluxoEntradas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fluxoDespesas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f87171" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="dia" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis
            stroke="#52525b"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={72}
            tickFormatter={(value) => formatCurrency(Number(value)).replace(/,\d{2}$/, "")}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => [
              formatCurrency(Number(value)),
              name === "entradas" ? "Entradas" : "Despesas",
            ]}
          />
          <Area
            type="monotone"
            dataKey="entradas"
            stroke="#34d399"
            strokeWidth={2.4}
            fill="url(#fluxoEntradas)"
            dot={false}
            activeDot={{ r: 4, fill: "#34d399" }}
          />
          <Area
            type="monotone"
            dataKey="despesas"
            stroke="#f87171"
            strokeWidth={2.4}
            fill="url(#fluxoDespesas)"
            dot={false}
            activeDot={{ r: 4, fill: "#f87171" }}
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
      <p className="flex h-[220px] items-center justify-center text-sm text-zinc-500">
        Sem despesas neste período.
      </p>
    );
  }

  return (
    <div className="h-[220px] w-full lg:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="category"
            innerRadius={58}
            outerRadius={82}
            paddingAngle={3}
            stroke="none"
          >
            {data.map((entry) => (
              <Cell key={entry.category} fill={categoryColor(entry.category)} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => [formatCurrency(Number(value)), name]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
