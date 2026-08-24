"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatMonthLabel } from "@/lib/finance/format";
import { seriesColor } from "@/components/ativos/LucroDiarioChart";
import type { AssetPnlRow } from "@/lib/finance/investment-pnl";

const tooltipStyle = {
  background: "#141414",
  border: "1px solid #27272a",
  borderRadius: 12,
  fontSize: 12,
};

export function EconomiaMensalChart({
  data,
}: {
  data: { mes: string; entradas: number; despesas: number }[];
}) {
  const chartData = data.map((item) => ({
    mes: formatMonthLabel(item.mes),
    Economia: item.entradas - item.despesas,
  }));

  return (
    <div className="h-[240px] w-full lg:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
          <Line type="monotone" dataKey="Economia" stroke="#34d399" strokeWidth={2.4} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FluxoDiarioChart({
  data,
}: {
  data: { dia: string; entradas: number; despesas: number }[];
}) {
  return (
    <div className="h-[240px] w-full lg:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="dia" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis
            stroke="#52525b"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={64}
            tickFormatter={(value) => formatCurrency(Number(value)).replace(/,\d{2}$/, "")}
          />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value))} />
          <Bar dataKey="entradas" name="Entradas" fill="#34d399" radius={[4, 4, 0, 0]} />
          <Bar dataKey="despesas" name="Despesas" fill="#f87171" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SemanaGastosChart({
  data,
}: {
  data: { dia: string; total: number }[];
}) {
  return (
    <div className="h-[240px] w-full lg:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="dia" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis
            stroke="#52525b"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={64}
            tickFormatter={(value) => formatCurrency(Number(value)).replace(/,\d{2}$/, "")}
          />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value))} />
          <Bar dataKey="total" name="Gastos" fill="#22d3ee" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MixPizzaChart({
  data,
}: {
  data: { name: string; value: number; color: string }[];
}) {
  const filtered = data.filter((item) => item.value > 0);
  if (filtered.length === 0) {
    return <p className="flex h-[240px] items-center justify-center text-sm text-zinc-500">Sem dados para o mix.</p>;
  }

  return (
    <div className="h-[240px] w-full lg:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={filtered} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={3} stroke="none">
            {filtered.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [formatCurrency(Number(value)), name]} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LucroAtivosBarChart({ rows }: { rows: AssetPnlRow[] }) {
  const chartData = rows.slice(0, 10).map((row, index) => ({
    nome: row.label,
    lucro: row.d30,
    fill: seriesColor(row.label, index),
  }));

  if (chartData.length === 0) {
    return <p className="flex h-[280px] items-center justify-center text-sm text-zinc-500">Sem lucro no período.</p>;
  }

  return (
    <div className="h-[280px] w-full lg:h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 6" horizontal={false} />
          <XAxis
            type="number"
            stroke="#52525b"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => formatCurrency(Number(value)).replace(/,\d{2}$/, "")}
          />
          <YAxis type="category" dataKey="nome" stroke="#52525b" fontSize={10} width={110} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value))} />
          <Bar dataKey="lucro" name="Lucro 30 dias" radius={[0, 6, 6, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`${entry.nome}-${index}`} fill={entry.lucro >= 0 ? "#34d399" : "#f87171"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
