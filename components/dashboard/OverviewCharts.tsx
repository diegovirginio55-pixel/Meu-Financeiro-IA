"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatMonthLabel } from "@/lib/finance/format";
import { categoryColor } from "@/lib/finance/categories";

const tooltipStyle = {
  background: "#141414",
  border: "1px solid #27272a",
  borderRadius: 12,
  fontSize: 12,
};

export function SaldoEvolutionChart({
  data,
}: {
  data: { mes: string; saldo: number; patrimonio: number }[];
}) {
  const chartData = data.map((item) => ({
    ...item,
    label: formatMonthLabel(item.mes),
  }));

  return (
    <div className="h-[240px] w-full lg:h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="saldoFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis hide />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => [
              formatCurrency(Number(value)),
              name === "saldo" ? "Saldo em contas" : "Patrimônio",
            ]}
            labelFormatter={(label) => String(label)}
          />
          <Area
            type="monotone"
            dataKey="patrimonio"
            stroke="#a1a1aa"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            fill="none"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="saldo"
            stroke="#ef4444"
            strokeWidth={2.4}
            fill="url(#saldoFill)"
            dot={false}
            activeDot={{ r: 5, fill: "#ef4444", stroke: "#fff", strokeWidth: 1 }}
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
  const chartData = data.map((item) => ({
    mes: formatMonthLabel(item.mes),
    Entradas: item.entradas,
    Despesas: item.despesas,
  }));

  return (
    <div className="h-[240px] w-full lg:h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="mes" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis
            stroke="#52525b"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={64}
            tickFormatter={(value) => formatCurrency(Number(value)).replace(/,\d{2}$/, "")}
          />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value))} />
          <Bar dataKey="Entradas" fill="#34d399" radius={[6, 6, 0, 0]} />
          <Bar dataKey="Despesas" fill="#f87171" radius={[6, 6, 0, 0]} />
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
    return <p className="flex h-[240px] items-center justify-center text-sm text-zinc-500">Sem despesas neste mês.</p>;
  }

  return (
    <div className="h-[240px] w-full lg:h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="category"
            innerRadius={58}
            outerRadius={84}
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
