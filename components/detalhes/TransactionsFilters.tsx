"use client";

import { CATEGORIES } from "@/lib/finance/categories";
import type { Account, Card } from "@/lib/finance/types";

export interface FiltersState {
  period: "hoje" | "semana" | "mes" | "ano" | "todos";
  category: string;
  accountId: string;
  cardId: string;
  type: string;
}

const PERIODS: { value: FiltersState["period"]; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mês" },
  { value: "ano", label: "Ano" },
  { value: "todos", label: "Tudo" },
];

export default function TransactionsFilters({
  filters,
  onChange,
  accounts,
  cards,
}: {
  filters: FiltersState;
  onChange: (filters: FiltersState) => void;
  accounts: Account[];
  cards: Card[];
}) {
  function update<K extends keyof FiltersState>(key: K, value: FiltersState[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex overflow-hidden rounded-lg border border-zinc-700">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => update("period", p.value)}
            className={`px-3 py-1.5 text-sm ${
              filters.period === p.value
                ? "bg-emerald-600 text-white"
                : "bg-zinc-900 text-zinc-400 hover:text-zinc-100"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <select
        value={filters.category}
        onChange={(e) => update("category", e.target.value)}
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 [color-scheme:dark]"
      >
        <option value="">Categoria</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <select
        value={filters.type}
        onChange={(e) => update("type", e.target.value)}
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 [color-scheme:dark]"
      >
        <option value="">Entradas e saídas</option>
        <option value="entrada">Entradas</option>
        <option value="saida">Saídas</option>
      </select>

      <select
        value={filters.accountId}
        onChange={(e) => update("accountId", e.target.value)}
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 [color-scheme:dark]"
      >
        <option value="">Conta</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>

      <select
        value={filters.cardId}
        onChange={(e) => update("cardId", e.target.value)}
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 [color-scheme:dark]"
      >
        <option value="">Cartão</option>
        {cards.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
