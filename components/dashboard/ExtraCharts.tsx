"use client";

import { useEffect, useId, useState } from "react";
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
import { barMoneyLabel, chartTooltipStyle, compactAxis, compactShort } from "@/components/dashboard/chart-theme";
import type { AssetPnlRow, YieldPoint } from "@/lib/finance/investment-pnl";

// O ResponsiveContainer do Recharts só sabe o tamanho real depois de montar no
// navegador; renderizá-lo no servidor produz um SVG diferente do que aparece
// no cliente e pode gerar erro de hidratação. Esses três gráficos (usados no
// painel de lucro dos investimentos) esperam montar antes de desenhar.
function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

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

export function CategoryCompareChart({
  data,
  currentLabel,
  previousLabel,
}: {
  data: { category: string; atual: number; anterior: number }[];
  currentLabel: string;
  previousLabel: string;
}) {
  const uid = useId().replace(/:/g, "");
  const rows = [...data].sort((a, b) => Math.max(b.atual, b.anterior) - Math.max(a.atual, a.anterior)).slice(0, 8);
  const height = Math.min(360, Math.max(200, rows.length * 56 + 40));

  if (rows.length === 0) {
    return <p className="flex h-[240px] items-center justify-center text-sm text-zinc-500">Sem gastos para comparar ainda.</p>;
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" barCategoryGap="30%" margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id={`compareAtual-${uid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#7dd3fc" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 10" horizontal={false} strokeOpacity={0.7} />
          <XAxis type="number" stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} tickFormatter={compactAxis} />
          <YAxis
            type="category"
            dataKey="category"
            stroke="#d4d4d8"
            fontSize={11}
            width={104}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <Tooltip
            contentStyle={chartTooltipStyle}
            formatter={(value, name) => [formatCurrency(Number(value)), name === "atual" ? currentLabel : previousLabel]}
          />
          <Legend
            verticalAlign="top"
            height={28}
            wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }}
            formatter={(value) => (value === "atual" ? currentLabel : previousLabel)}
          />
          <Bar dataKey="anterior" name="anterior" fill="#52525b" radius={[0, 8, 8, 0]} maxBarSize={16} />
          <Bar dataKey="atual" name="atual" fill={`url(#compareAtual-${uid})`} radius={[0, 8, 8, 0]} maxBarSize={16} />
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

function shortenAssetLabel(name: string, max = 26) {
  const cleaned = name.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

function LucroAtivoTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { nome: string; lucro: number } }>;
}) {
  if (!active || !payload?.[0]) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-2xl border border-zinc-700/70 bg-zinc-950 px-3.5 py-2.5 shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
      <p className="max-w-[240px] text-[11px] leading-snug text-zinc-400">{row.nome}</p>
      <p className={`mt-1 text-sm font-semibold ${row.lucro >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
        {formatCurrency(row.lucro)}
      </p>
      <p className="text-[11px] text-zinc-500">lucro em 30 dias</p>
    </div>
  );
}

export function LucroAtivosBarChart({ rows }: { rows: AssetPnlRow[] }) {
  const mounted = useMounted();
  const uid = useId().replace(/:/g, "");
  const chartData = rows.slice(0, 10).map((row) => ({
    nome: row.label,
    label: shortenAssetLabel(row.label),
    lucro: Math.abs(row.d30) >= 0.005 ? row.d30 : row.accumulated,
  }));
  const peak = Math.max(...chartData.map((item) => item.lucro), 0);
  const height = Math.min(360, Math.max(188, chartData.length * 64 + 36));

  if (chartData.length === 0) {
    return <p className="flex h-[280px] items-center justify-center text-sm text-zinc-500">Sem lucro no período.</p>;
  }

  if (!mounted) {
    return <div className="w-full animate-pulse rounded-xl bg-zinc-900/40" style={{ height }} />;
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          barCategoryGap="28%"
          margin={{ top: 8, right: 64, left: 4, bottom: 4 }}
        >
          <defs>
            <linearGradient id={`ativoFill-${uid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#047857" />
              <stop offset="55%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#6ee7b7" />
            </linearGradient>
            <linearGradient id={`ativoPeak-${uid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#059669" />
              <stop offset="45%" stopColor="#6ee7b7" />
              <stop offset="100%" stopColor="#d1fae5" />
            </linearGradient>
            <linearGradient id={`ativoNeg-${uid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#e11d48" />
              <stop offset="100%" stopColor="#fda4af" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 10" horizontal={false} strokeOpacity={0.7} />
          <XAxis
            type="number"
            stroke="#a1a1aa"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={compactAxis}
          />
          <YAxis
            type="category"
            dataKey="label"
            stroke="#d4d4d8"
            fontSize={11}
            width={132}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <Tooltip cursor={{ fill: "rgba(52, 211, 153, 0.06)" }} content={<LucroAtivoTooltip />} />
          <Bar dataKey="lucro" name="Lucro 30 dias" radius={[0, 10, 10, 0]} maxBarSize={26}>
            <LabelList
              dataKey="lucro"
              position="right"
              formatter={(value) => formatCurrency(Number(value))}
              fill="#d4d4d8"
              fontSize={11}
            />
            {chartData.map((entry, index) => {
              const fill = entry.lucro < 0
                ? `url(#ativoNeg-${uid})`
                : entry.lucro === peak && peak > 0
                  ? `url(#ativoPeak-${uid})`
                  : `url(#ativoFill-${uid})`;
              return <Cell key={`${entry.nome}-${index}`} fill={fill} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function YieldTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: YieldPoint }>;
  label?: string;
}) {
  if (!active || !payload?.[0]) return null;
  const row = payload[0].payload;
  const up = row.rendimento >= 0;
  return (
    <div className="rounded-2xl border border-zinc-700/70 bg-zinc-950/95 px-3.5 py-2.5 shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
      <p className="text-[11px] text-zinc-400">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${up ? "text-emerald-400" : "text-rose-400"}`}>
        {formatPercent(row.rendimento, 3)}
      </p>
      <p className="text-[11px] text-zinc-500">{formatCurrency(row.lucro)} no dia</p>
    </div>
  );
}

export function RendimentoDiarioChart({ data }: { data: YieldPoint[] }) {
  const mounted = useMounted();
  const uid = useId().replace(/:/g, "");
  const hasValues = data.some((point) => point.lucro !== 0 || point.rendimento !== 0);
  const peak = data.reduce(
    (best, item) => (item.lucro > best.lucro ? item : best),
    data[0] ?? { date: "", label: "", lucro: 0, capital: 0, rendimento: 0 },
  );

  if (!mounted) {
    return <div className="h-[268px] w-full animate-pulse rounded-xl bg-zinc-900/40 lg:h-[312px]" />;
  }

  return (
    <div className="relative h-[268px] w-full lg:h-[312px]">
      {!hasValues && (
        <p className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-6 text-center text-sm text-zinc-500">
          Sem rendimento diário ainda. Sincronize os bancos para começar o histórico.
        </p>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="22%" margin={{ top: 26, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`yieldFill-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6ee7b7" />
              <stop offset="55%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>
            <linearGradient id={`yieldPeak-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d1fae5" />
              <stop offset="40%" stopColor="#6ee7b7" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id={`yieldNeg-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fda4af" />
              <stop offset="100%" stopColor="#e11d48" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 10" vertical={false} strokeOpacity={0.75} />
          <XAxis
            dataKey="label"
            stroke="#a1a1aa"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            interval={4}
            minTickGap={18}
            dy={8}
          />
          <YAxis
            stroke="#a1a1aa"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={compactAxis}
          />
          <Tooltip cursor={{ fill: "rgba(52, 211, 153, 0.08)" }} content={<YieldTooltip />} />
          <Bar dataKey="lucro" name="Lucro" radius={[7, 7, 3, 3]} maxBarSize={16}>
            <LabelList
              dataKey="lucro"
              position="top"
              formatter={barMoneyLabel}
              fill="#d4d4d8"
              fontSize={8}
              offset={4}
              angle={data.length > 14 ? -70 : 0}
            />
            {data.map((entry) => {
              const empty = Math.abs(entry.lucro) < 0.005;
              const isPeak = !empty && entry.date === peak.date;
              const fill = entry.lucro < 0
                ? `url(#yieldNeg-${uid})`
                : isPeak
                  ? `url(#yieldPeak-${uid})`
                  : `url(#yieldFill-${uid})`;
              return <Cell key={entry.date} fill={fill} fillOpacity={empty ? 0.16 : 1} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RendimentoMensalChart({ data }: { data: YieldPoint[] }) {
  const mounted = useMounted();
  const hasValues = data.some((point) => point.rendimento !== 0 || point.lucro !== 0);

  if (!mounted) {
    return <div className="h-[256px] w-full animate-pulse rounded-xl bg-zinc-900/40 lg:h-[296px]" />;
  }

  return (
    <div className="relative h-[256px] w-full lg:h-[296px]">
      {!hasValues && (
        <p className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-6 text-center text-sm text-zinc-500">
          Sem rendimento mensal ainda. Os meses vão preenchendo a cada sincronização.
        </p>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="24%" maxBarSize={36} margin={{ top: 24, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid stroke="#27272a" strokeDasharray="4 8" vertical={false} />
          <XAxis dataKey="label" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} dy={8} interval={0} />
          <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} width={56} tickFormatter={compactAxis} />
          <Tooltip
            contentStyle={chartTooltipStyle}
            formatter={(value, _name, item) => {
              const row = item?.payload as YieldPoint | undefined;
              return [formatCurrency(Number(row?.lucro ?? value)), "Lucro"];
            }}
            labelFormatter={(label, payload) => {
              const row = payload?.[0]?.payload as YieldPoint | undefined;
              if (!row) return String(label);
              return `${label} · ${formatPercent(row.rendimento, 2)}`;
            }}
          />
          <Bar dataKey="lucro" name="lucro" radius={[10, 10, 4, 4]}>
            <LabelList
              dataKey="lucro"
              position="top"
              formatter={barMoneyLabel}
              fill="#d4d4d8"
              fontSize={11}
              offset={6}
            />
            {data.map((entry) => (
              <Cell key={entry.date} fill={entry.lucro >= 0 ? "#34d399" : "#fb7185"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
