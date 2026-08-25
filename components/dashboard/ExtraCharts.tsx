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
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatMonthLabel, formatPercent } from "@/lib/finance/format";
import { seriesColor } from "@/components/ativos/LucroDiarioChart";
import { chartTooltipStyle, compactAxis } from "@/components/dashboard/chart-theme";
import type { AssetPnlRow, YieldPoint } from "@/lib/finance/investment-pnl";

export function EconomiaMensalChart({
  data,
}: {
  data: { mes: string; entradas: number; despesas: number }[];
}) {
  const uid = useId().replace(/:/g, "");
  const chartData = data.map((item) => ({
    mes: item.mes,
    label: formatMonthLabel(item.mes),
    Economia: item.entradas - item.despesas,
  }));

  return (
    <div className="h-[240px] w-full lg:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 12, right: 8, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id={`ecoFill-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#27272a" strokeDasharray="4 8" vertical={false} />
          <XAxis dataKey="label" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} dy={8} />
          <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} width={72} tickFormatter={compactAxis} />
          <Tooltip
            contentStyle={chartTooltipStyle}
            formatter={(value) => formatCurrency(Number(value))}
            labelFormatter={(_, payload) => {
              const mes = (payload?.[0]?.payload as { mes?: string } | undefined)?.mes;
              return mes ? mes.replace("-", "/") : "";
            }}
          />
          <Area
            type="monotone"
            dataKey="Economia"
            stroke="#34d399"
            strokeWidth={2.4}
            fill={`url(#ecoFill-${uid})`}
            dot={false}
            activeDot={{ r: 5, fill: "#34d399", stroke: "#09090b", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FluxoDiarioChart({
  data,
}: {
  data: { dia: string; entradas: number; despesas: number }[];
}) {
  const uid = useId().replace(/:/g, "");

  return (
    <div className="h-[240px] w-full lg:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 8, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id={`dayIn-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`dayOut-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fb7185" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#fb7185" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#27272a" strokeDasharray="4 8" vertical={false} />
          <XAxis dataKey="dia" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" dy={8} />
          <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} width={72} tickFormatter={compactAxis} />
          <Tooltip contentStyle={chartTooltipStyle} formatter={(value, name) => [formatCurrency(Number(value)), name]} />
          <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
          <Area type="monotone" dataKey="entradas" name="Entradas" stroke="#34d399" strokeWidth={2} fill={`url(#dayIn-${uid})`} dot={false} />
          <Area type="monotone" dataKey="despesas" name="Despesas" stroke="#fb7185" strokeWidth={2} fill={`url(#dayOut-${uid})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SemanaGastosChart({
  data,
}: {
  data: { dia: string; total: number }[];
}) {
  const uid = useId().replace(/:/g, "");
  const max = Math.max(...data.map((item) => item.total), 1);

  return (
    <div className="h-[240px] w-full lg:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="22%" maxBarSize={42} margin={{ top: 12, right: 8, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id={`weekFill-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#67e8f9" />
              <stop offset="100%" stopColor="#0891b2" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#27272a" strokeDasharray="4 8" vertical={false} />
          <XAxis dataKey="dia" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} dy={8} />
          <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} width={72} tickFormatter={compactAxis} />
          <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => formatCurrency(Number(value))} />
          <Bar dataKey="total" name="Gastos" radius={[10, 10, 4, 4]}>
            {data.map((entry) => (
              <Cell
                key={entry.dia}
                fill={entry.total === max && max > 0 ? "#22d3ee" : `url(#weekFill-${uid})`}
              />
            ))}
          </Bar>
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
  const grand = filtered.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="flex h-[240px] items-center gap-2 lg:h-[300px]">
      <div className="h-full min-w-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={filtered}
              dataKey="value"
              nameKey="name"
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={4}
              stroke="#09090b"
              strokeWidth={3}
            >
              {filtered.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={chartTooltipStyle} formatter={(value, name) => [formatCurrency(Number(value)), name]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-[42%] max-w-[180px] shrink-0 space-y-2.5 pr-1">
        {filtered.map((item) => (
          <li key={item.name} className="flex items-start gap-2 text-xs">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="min-w-0">
              <span className="block text-zinc-200">{item.name}</span>
              <span className="text-zinc-500">
                {grand > 0 ? `${Math.round((item.value / grand) * 100)}%` : "0%"} · {formatCurrency(item.value)}
              </span>
            </span>
          </li>
        ))}
      </ul>
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
        <BarChart data={chartData} layout="vertical" barCategoryGap="18%" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="#27272a" strokeDasharray="4 8" horizontal={false} />
          <XAxis type="number" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} tickFormatter={compactAxis} />
          <YAxis type="category" dataKey="nome" stroke="#a1a1aa" fontSize={11} width={118} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => formatCurrency(Number(value))} />
          <Bar dataKey="lucro" name="Lucro 30 dias" radius={[0, 10, 10, 0]} maxBarSize={18}>
            {chartData.map((entry, index) => (
              <Cell key={`${entry.nome}-${index}`} fill={entry.lucro >= 0 ? "#34d399" : "#fb7185"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatAxisPercent(value: number): string {
  return `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

export function RendimentoDiarioChart({ data }: { data: YieldPoint[] }) {
  const uid = useId().replace(/:/g, "");
  const hasValues = data.some((point) => point.rendimento !== 0);
  return (
    <div className="relative h-[240px] w-full lg:h-[280px]">
      {!hasValues && (
        <p className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-6 text-center text-sm text-zinc-500">
          Sem rendimento diário ainda. Sincronize os bancos para começar o histórico.
        </p>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 8, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id={`yieldStroke-${uid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6ee7b7" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#27272a" strokeDasharray="4 8" vertical={false} />
          <XAxis dataKey="label" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} dy={8} />
          <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} width={52} tickFormatter={formatAxisPercent} />
          <Tooltip
            contentStyle={chartTooltipStyle}
            formatter={(value) => [formatPercent(Number(value), 3), "Rendimento"]}
            labelFormatter={(label, payload) => {
              const row = payload?.[0]?.payload as YieldPoint | undefined;
              if (!row) return String(label);
              return `${label} · ${formatCurrency(row.lucro)}`;
            }}
          />
          <Line
            type="monotone"
            dataKey="rendimento"
            name="rendimento"
            stroke={`url(#yieldStroke-${uid})`}
            strokeWidth={2.6}
            dot={false}
            activeDot={{ r: 5, fill: "#34d399", stroke: "#09090b", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RendimentoMensalChart({ data }: { data: YieldPoint[] }) {
  const hasValues = data.some((point) => point.rendimento !== 0 || point.lucro !== 0);
  return (
    <div className="relative h-[240px] w-full lg:h-[280px]">
      {!hasValues && (
        <p className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-6 text-center text-sm text-zinc-500">
          Sem rendimento mensal ainda. Os meses vão preenchendo a cada sincronização.
        </p>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="24%" maxBarSize={36} margin={{ top: 12, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid stroke="#27272a" strokeDasharray="4 8" vertical={false} />
          <XAxis dataKey="label" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} dy={8} />
          <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} width={52} tickFormatter={formatAxisPercent} />
          <Tooltip
            contentStyle={chartTooltipStyle}
            formatter={(value) => [formatPercent(Number(value), 2), "Rendimento"]}
            labelFormatter={(label, payload) => {
              const row = payload?.[0]?.payload as YieldPoint | undefined;
              if (!row) return String(label);
              return `${label} · ${formatCurrency(row.lucro)}`;
            }}
          />
          <Bar dataKey="rendimento" name="rendimento" radius={[10, 10, 4, 4]}>
            {data.map((entry) => (
              <Cell key={entry.date} fill={entry.rendimento >= 0 ? "#34d399" : "#fb7185"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
