"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { formatCurrency } from "@/lib/finance/format";
import { CATEGORY_COLORS } from "@/lib/finance/categories";

interface Props {
  data: { category: string; total: number }[];
}

export default function CategoriaPieChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="mb-4 text-sm font-medium text-zinc-300">
          Gastos por categoria (mês)
        </h2>
        <p className="flex flex-1 items-center justify-center text-sm text-zinc-500">
          Ainda não há despesas registradas este mês.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="mb-4 text-sm font-medium text-zinc-300">
        Gastos por categoria (mês)
      </h2>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="category"
            innerRadius={60}
            outerRadius={95}
            paddingAngle={2}
          >
            {data.map((entry) => (
              <Cell
                key={entry.category}
                fill={CATEGORY_COLORS[entry.category] ?? "#71717a"}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
            formatter={(value) => formatCurrency(Number(value))}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
