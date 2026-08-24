"use client";

import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/finance/format";
import { getBankBrand } from "@/lib/pluggy/brands";
import type { DailyPnlPoint, PnlSeriesKey } from "@/lib/finance/investment-pnl";

const tooltipStyle = {
  background: "#141414",
  border: "1px solid #27272a",
  borderRadius: 12,
  fontSize: 12,
};

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
          Ainda não há lucro diário suficiente. Sincronize os bancos para gravar o primeiro dia; o gráfico
          preenche a cada nova sincronização.
        </p>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="lucroTotalFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="label" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
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
            formatter={(value, name) => [formatCurrency(Number(value)), name]}
          />
          {showLines && lines.length <= 12 && <Legend />}
          {showTotal && (
            <Area
              type="monotone"
              dataKey="Total"
              name="Total"
              stroke="#34d399"
              strokeWidth={2.6}
              fill="url(#lucroTotalFill)"
              dot={false}
              activeDot={{ r: 4, fill: "#34d399" }}
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
                activeDot={{ r: 4 }}
              />
            ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
