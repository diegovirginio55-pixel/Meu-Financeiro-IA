"use client";

import { CATEGORIES } from "@/lib/finance/categories";
import { accountBankLabel, cardBankLabel, isPlaceholderAccount, isPlaceholderCard } from "@/lib/finance/account-name";
import type { Account, Card } from "@/lib/finance/types";
import { chipClass } from "@/components/ui/page-chrome";

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
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => update("period", p.value)}
            className={chipClass(filters.period === p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(
          [
            ["", "Tudo"],
            ["entrada", "Entradas"],
            ["saida", "Saídas"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value || "all-type"}
            type="button"
            onClick={() => update("type", value)}
            className={chipClass(filters.type === value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select
          value={filters.category}
          onChange={(e) => update("category", e.target.value)}
          className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-200 outline-none"
        >
          <option value="">Categoria</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filters.accountId}
          onChange={(e) => update("accountId", e.target.value)}
          className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-200 outline-none"
        >
          <option value="">Todas as contas</option>
          {accounts
            .filter((a) => !isPlaceholderAccount(a))
            .map((a) => (
              <option key={a.id} value={a.id}>
                {accountBankLabel(a)}
              </option>
            ))}
        </select>
        <select
          value={filters.cardId}
          onChange={(e) => update("cardId", e.target.value)}
          className="col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-200 outline-none"
        >
          <option value="">Todos os cartões</option>
          {cards
            .filter((c) => !isPlaceholderCard(c))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {cardBankLabel(c)}
              </option>
            ))}
        </select>
      </div>
    </div>
  );
}
