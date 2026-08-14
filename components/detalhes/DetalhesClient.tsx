"use client";

import { useCallback, useEffect, useState } from "react";
import TransactionsFilters, { type FiltersState } from "./TransactionsFilters";
import TransactionsTable from "./TransactionsTable";
import type { Account, Card, Transaction } from "@/lib/finance/types";

const DEFAULT_FILTERS: FiltersState = {
  period: "mes",
  category: "",
  accountId: "",
  cardId: "",
  type: "",
};

export default function DetalhesClient() {
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (f: FiltersState) => {
    const params = new URLSearchParams();
    if (f.period !== "todos") params.set("period", f.period);
    if (f.category) params.set("category", f.category);
    if (f.accountId) params.set("account_id", f.accountId);
    if (f.cardId) params.set("card_id", f.cardId);
    if (f.type) params.set("type", f.type);

    const res = await fetch(`/api/transactions?${params.toString()}`);
    const data = await res.json();
    setTransactions(data.transactions ?? []);
    setAccounts(data.accounts ?? []);
    setCards(data.cards ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // setState only happens after the fetch (async, post-await), the linter
    // can't trace that across the useCallback boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(filters);
  }, [filters, load]);

  async function handleUpdate(id: string, patch: Record<string, unknown>) {
    await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await load(filters);
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este lançamento?")) return;
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    await load(filters);
  }

  const totalEntradas = transactions
    .filter((t) => t.type === "entrada")
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalSaidas = transactions
    .filter((t) => t.type === "saida")
    .reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="flex flex-col gap-4">
      <TransactionsFilters
        filters={filters}
        onChange={setFilters}
        accounts={accounts}
        cards={cards}
      />

      <div className="flex gap-4 text-sm text-zinc-400">
        <span>
          {transactions.length} lançamento(s) · Entradas{" "}
          <span className="text-emerald-400">
            {totalEntradas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>{" "}
          · Despesas{" "}
          <span className="text-red-400">
            {totalSaidas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Carregando lançamentos...</p>
      ) : (
        <TransactionsTable
          transactions={transactions}
          accounts={accounts}
          cards={cards}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}

      <p className="text-xs text-zinc-500">
        Editar aqui corrige a descrição, categoria, valor ou data do
        lançamento — mas não reajusta automaticamente o saldo da conta ou
        fatura do cartão.
      </p>
    </div>
  );
}
