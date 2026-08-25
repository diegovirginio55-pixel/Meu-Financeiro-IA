"use client";

import { useId } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/finance/format";
import { getBankBrand } from "@/lib/pluggy/brands";
import { compactAxis } from "@/components/dashboard/chart-theme";
import type { DailyPnlPoint, PnlSeriesKey } from "@/lib/finance/investment-pnl";

const FALLBACK_COLORS = [
  "#34d399",
  "#60a5fa",
  "#fbbf24",
  "#f472b6",
  "#22d3ee",
  "#a78bfa",
  "#fb7185",
  "#4ade80",
  "#f97316",
  "#38bdf8",
  "#e879f9",
  "#facc15",
];

export function seriesColor(key: string, index: number): string {
  const brand = getBankBrand(key);
  if (brand) return brand.bg;
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

type ChartVariant = "line" | "bar";

export function LucroDiarioChart({
  data,
  banks,
  series,
  mode = "ambos",
  height = 280,
  variant = "bar",
}: {
  data: DailyPnlPoint[];
  banks?: string[];
  series?: PnlSeriesKey[];
  mode?: "juntos" | "separados" | "ambos";
  height?: number;
  variant?: ChartVariant;
}) {
  const uid = useId().replace(/:/g, "");
  const lines = series ?? (banks ?? []).map((bank) => ({ key: bank, label: bank }));
  const showTotal = mode !== "separados";
  const showLines = mode !== "juntos";
  const barKeys = showLines && lines.length > 0 ? lines : [{ key: "Total", label: "Total" }];
  const hasValues = data.some((point) =>
    [point.Total, ...lines.map((item) => Number(point[item.key] ?? 0))].some((value) => value !== 0),
  );
  const peak = data.reduce(
    (best, item) => (Number(item.Total) > Number(best.Total) ? item : best),
    data[0] ?? { date: "", label: "", Total: 0 },
  );

  return (
    <div className="relative w-full" style={{ height }}>
      {!hasValues && (
        <p className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-6 text-center text-sm text-zinc-500">
          Ainda não há variação de lucro para montar o gráfico. Sincronize os bancos: o app grava o valor de cada dia e o lucro aparece na sequência.
        </p>
      )}
      <ResponsiveContainer width="100%" height="100%">
        {variant === "bar" ? (
          <BarChart data={data} barCategoryGap="18%" margin={{ top: 12, right: 8, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id={`lucroFill-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6ee7b7" />
                <stop offset="55%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
              <linearGradient id={`lucroPeak-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d1fae5" />
                <stop offset="40%" stopColor="#6ee7b7" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
              <linearGradient id={`lucroNeg-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fda4af" />
                <stop offset="100%" stopColor="#e11d48" />
              </linearGradient>
              {barKeys.map((item, index) => (
                <linearGradient key={item.key} id={`lucroSeries-${uid}-${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={seriesColor(item.label, index)} stopOpacity={1} />
                  <stop offset="100%" stopColor={seriesColor(item.label, index)} stopOpacity={0.62} />
                </linearGradient>
              ))}
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
              width={72}
              tickFormatter={compactAxis}
            />
            <Tooltip cursor={{ fill: "rgba(52, 211, 153, 0.08)" }} content={<LucroTooltip />} />
            {barKeys.length > 1 && barKeys.length <= 12 && (
              <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
            )}
            {barKeys.length === 1 ? (
              <Bar dataKey={barKeys[0].key} name={barKeys[0].label} radius={[7, 7, 3, 3]} maxBarSize={16}>
                {data.map((entry) => {
                  const value = Number(entry[barKeys[0].key] ?? 0);
                  const empty = Math.abs(value) < 0.005;
                  const isPeak = !empty && entry.date === peak.date;
                  const fill = value < 0
                    ? `url(#lucroNeg-${uid})`
                    : isPeak
                      ? `url(#lucroPeak-${uid})`
                      : `url(#lucroFill-${uid})`;
                  return <Cell key={entry.date} fill={fill} fillOpacity={empty ? 0.16 : 1} />;
                })}
              </Bar>
            ) : (
              barKeys.map((item, index) => (
                <Bar
                  key={item.key}
                  dataKey={item.key}
                  name={item.label}
                  stackId="lucro"
                  fill={`url(#lucroSeries-${uid}-${index})`}
                  maxBarSize={18}
                  radius={
                    barKeys.length === 1
                      ? [7, 7, 3, 3]
                      : index === barKeys.length - 1
                        ? [7, 7, 0, 0]
                        : index === 0
                          ? [0, 0, 3, 3]
                          : 0
                  }
                />
              ))
            )}
          </BarChart>
        ) : (
          <ComposedChart data={data} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id={`lucroTotalFill-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.38} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#27272a" strokeDasharray="4 8" vertical={false} />
            <XAxis
              dataKey="label"
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
            <Tooltip cursor={{ fill: "rgba(52, 211, 153, 0.08)" }} content={<LucroTooltip />} />
            {showLines && lines.length <= 12 && (
              <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
            )}
            {showTotal && (
              <Area
                type="monotone"
                dataKey="Total"
                name="Total"
                stroke="#34d399"
                strokeWidth={2.6}
                fill={`url(#lucroTotalFill-${uid})`}
                dot={false}
                activeDot={{ r: 5, fill: "#34d399", stroke: "#09090b", strokeWidth: 2 }}
              />
            )}
            {showLines &&
              lines.map((item, index) => (
                <Line
                  key={item.key}
                  type="monotone"
                  dataKey={item.key}
                  name={item.label}
                  stroke={seriesColor(item.label, index)}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, stroke: "#09090b", strokeWidth: 2 }}
                />
              ))}
          </ComposedChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function LucroTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum, item) => sum + Number(item.value ?? 0), 0);
  return (
    <div className="rounded-2xl border border-zinc-700/70 bg-zinc-950/95 px-3.5 py-2.5 shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
      <p className="text-[11px] text-zinc-400">{label}</p>
      <ul className="mt-1.5 space-y-1">
        {payload.map((item) => (
          <li key={item.name} className="flex items-center justify-between gap-4 text-[11px]">
            <span className="flex min-w-0 items-center gap-1.5 text-zinc-400">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="truncate">{item.name}</span>
            </span>
            <span className={`font-medium ${Number(item.value) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {formatCurrency(Number(item.value))}
            </span>
          </li>
        ))}
      </ul>
      {payload.length > 1 && (
        <p className="mt-2 border-t border-zinc-800 pt-1.5 text-right text-xs font-semibold text-zinc-100">
          {formatCurrency(total)}
        </p>
      )}
    </div>
  );
}
