"use client";

import { useId } from "react";
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/finance/format";
import { getBankBrand } from "@/lib/pluggy/brands";
import { chartTooltipStyle, compactAxis } from "@/components/dashboard/chart-theme";
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

export function LucroDiarioChart({
  data,
  banks,
  series,
  mode = "ambos",
  height = 280,
}: {
  data: DailyPnlPoint[];
  banks?: string[];
  series?: PnlSeriesKey[];
  mode?: "juntos" | "separados" | "ambos";
  height?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const lines = series ?? (banks ?? []).map((bank) => ({ key: bank, label: bank }));
  const showTotal = mode !== "separados";
  const showLines = mode !== "juntos";
  const hasValues = data.some((point) =>
    [point.Total, ...lines.map((item) => Number(point[item.key] ?? 0))].some((value) => value !== 0),
  );

  return (
    <div className="relative w-full" style={{ height }}>
      {!hasValues && (
        <p className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-6 text-center text-sm text-zinc-500">
          Ainda não há variação de lucro para montar o gráfico. Sincronize os bancos: o app grava o valor de cada dia e o lucro aparece na sequência.
        </p>
      )}
      <ResponsiveContainer width="100%" height="100%">
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
          <Tooltip contentStyle={chartTooltipStyle} formatter={(value, name) => [formatCurrency(Number(value)), name]} />
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
      </ResponsiveContainer>
    </div>
  );
}
