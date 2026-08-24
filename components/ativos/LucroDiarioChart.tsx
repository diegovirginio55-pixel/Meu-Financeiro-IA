"use client";

import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/finance/format";
import { getBankBrand } from "@/lib/pluggy/brands";
import type { DailyPnlPoint } from "@/lib/finance/investment-pnl";

const tooltipStyle = {
  background: "#141414",
  border: "1px solid #27272a",
  borderRadius: 12,
  fontSize: 12,
};

const FALLBACK_COLORS = ["#60a5fa", "#fbbf24", "#f472b6", "#22d3ee", "#a78bfa", "#fb7185"];

function bankColor(name: string, index: number): string {
  return getBankBrand(name)?.bg ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export function LucroDiarioChart({
  data,
  banks,
  mode,
}: {
  data: DailyPnlPoint[];
  banks: string[];
  mode: "juntos" | "separados" | "ambos";
}) {
  const showTotal = mode !== "separados";
  const showBanks = mode !== "juntos";
  const hasValues = data.some((point) =>
    [point.Total, ...banks.map((bank) => Number(point[bank] ?? 0))].some((value) => value !== 0),
  );

  return (
    <div className="relative h-[280px] w-full">
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
          <Legend />
          {showTotal && (
            <Area
              type="monotone"
              dataKey="Total"
              stroke="#34d399"
              strokeWidth={2.6}
              fill="url(#lucroTotalFill)"
              dot={false}
              activeDot={{ r: 4, fill: "#34d399" }}
            />
          )}
          {showBanks &&
            banks.map((bank, index) => (
              <Line
                key={bank}
                type="monotone"
                dataKey={bank}
                stroke={bankColor(bank, index)}
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
