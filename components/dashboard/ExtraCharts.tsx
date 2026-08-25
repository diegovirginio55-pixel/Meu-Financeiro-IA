"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatMonthLabel, formatPercent } from "@/lib/finance/format";
import { seriesColor } from "@/components/ativos/LucroDiarioChart";
import { chartTooltipStyle, compactAxis, compactShort } from "@/components/dashboard/chart-theme";
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
  const max = Math.max(...data.map((item) => item.total), 0);
  const peak = data.reduce((best, item) => (item.total > best.total ? item : best), data[0] ?? { dia: "", total: 0 });

  if (max <= 0) {
    return <p className="flex h-[240px] items-center justify-center text-sm text-zinc-500">Sem gastos neste mês.</p>;
  }

  return (
    <div>
      {peak.total > 0 && (
        <p className="mb-1 text-[11px] text-zinc-500">
          Maior dia: {peak.dia} · {formatCurrency(peak.total)}
        </p>
      )}
      <div className="h-[220px] w-full lg:h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="18%" maxBarSize={46} margin={{ top: 22, right: 8, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id={`weekFill-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fda4af" />
                <stop offset="100%" stopColor="#e11d48" />
              </linearGradient>
              <linearGradient id={`weekPeak-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fb7185" />
                <stop offset="100%" stopColor="#be123c" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#27272a" strokeDasharray="4 8" vertical={false} />
            <XAxis dataKey="dia" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} dy={8} />
            <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} width={72} tickFormatter={compactAxis} />
            <Tooltip
              contentStyle={chartTooltipStyle}
              cursor={{ fill: "rgba(244, 63, 94, 0.08)" }}
              formatter={(value) => [formatCurrency(Number(value)), "Gastos"]}
            />
            <Bar dataKey="total" name="Gastos" radius={[12, 12, 4, 4]}>
              <LabelList
                dataKey="total"
                position="top"
                formatter={(value) => compactShort(Number(value))}
                fill="#d4d4d8"
                fontSize={10}
              />
              {data.map((entry) => (
                <Cell
                  key={entry.dia}
                  fill={entry.total === max ? `url(#weekPeak-${uid})` : `url(#weekFill-${uid})`}
                  fillOpacity={entry.total === max ? 1 : 0.82}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
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
  const assets = filtered.filter((item) => item.name !== "Faturas");
  const centerTotal = assets.reduce((sum, item) => sum + item.value, 0) || grand;

  return (
    <div className="flex h-[240px] items-center gap-3 lg:h-[300px]">
      <div className="relative h-full min-w-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={filtered}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={5}
              cornerRadius={8}
              stroke="#09090b"
              strokeWidth={4}
            >
              {filtered.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={chartTooltipStyle} formatter={(value, name) => [formatCurrency(Number(value)), name]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pr-[2%]">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">Total</p>
          <p className="mt-0.5 max-w-[7.5rem] text-center text-sm font-semibold leading-tight text-white">
            {formatCurrency(centerTotal)}
          </p>
        </div>
      </div>
      <ul className="w-[46%] max-w-[200px] shrink-0 space-y-3 pr-1">
        {filtered.map((item) => {
          const share = grand > 0 ? (item.value / grand) * 100 : 0;
          return (
            <li key={item.name} className="flex items-start gap-2.5">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="min-w-0">
                <span className="block text-sm text-zinc-100">{item.name}</span>
                <span className="text-xs text-zinc-400">
                  {share.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% · {formatCurrency(item.value)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function LucroAtivosBarChart({ rows }: { rows: AssetPnlRow[] }) {
  const chartData = rows.slice(0, 10).map((row, index) => ({
    nome: row.label,
    lucro: Math.abs(row.d30) >= 0.005 ? row.d30 : row.accumulated,
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
  const hasValues = data.some((point) => point.rendimento !== 0);
  return (
    <div className="relative h-[240px] w-full lg:h-[280px]">
      {!hasValues && (
        <p className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-6 text-center text-sm text-zinc-500">
          Sem rendimento diário ainda. Sincronize os bancos para começar o histórico.
        </p>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="12%" maxBarSize={14} margin={{ top: 12, right: 8, left: 4, bottom: 0 }}>
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
          <Bar dataKey="rendimento" name="rendimento" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.date} fill={entry.rendimento >= 0 ? "#34d399" : "#fb7185"} />
            ))}
          </Bar>
        </BarChart>
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
