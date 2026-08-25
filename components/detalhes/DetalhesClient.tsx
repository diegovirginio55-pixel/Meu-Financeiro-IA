"use client";

import { useCallback, useEffect, useState } from "react";
import TransactionsFilters, { type FiltersState } from "./TransactionsFilters";
import TransactionsTable from "./TransactionsTable";
import type { Account, Card, Transaction } from "@/lib/finance/types";
import { formatCurrency, formatPercent } from "@/lib/finance/format";
import { HeroAmount, PageHero, PageShell, SoftPanel } from "@/components/ui/page-chrome";
import { usePersistedState } from "@/lib/ui/use-persisted-state";

const DEFAULT_FILTERS: FiltersState = {
  period: "mes",
  category: "",
  accountId: "",
  cardId: "",
  type: "",
};

export default function DetalhesClient() {
  const [filters, setFilters, filtersReady] = usePersistedState<FiltersState>("mf-detalhes-filters", DEFAULT_FILTERS);
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
    if (!filtersReady) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(filters);
  }, [filters, filtersReady, load]);

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
  const saldo = totalEntradas - totalSaidas;
  const movimento = totalEntradas + totalSaidas;
  const pctEntradas = movimento > 0 ? (totalEntradas / movimento) * 100 : 0;
  const pctSaidas = movimento > 0 ? (totalSaidas / movimento) * 100 : 0;

  return (
    <PageShell>
      <PageHero
        kicker="Extrato"
        title={<HeroAmount>{formatCurrency(saldo)}</HeroAmount>}
        subtitle={`${transactions.length} lançamentos neste filtro`}
      >
        <div className="mb-1.5 flex justify-between text-sm">
          <span className="font-semibold text-emerald-300">{formatPercent(pctEntradas, 1)}</span>
          <span className="font-semibold text-rose-300">{formatPercent(pctSaidas, 1)}</span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full shrink-0 bg-emerald-400" style={{ width: `${pctEntradas}%` }} />
          <div className="h-full shrink-0 bg-rose-400" style={{ width: `${pctSaidas}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-zinc-500">
          <span className="text-emerald-300">entradas {formatCurrency(totalEntradas)}</span>
          <span className="text-rose-300">saídas {formatCurrency(totalSaidas)}</span>
        </div>
      </PageHero>

      <div className="px-4 lg:px-6 xl:px-10 2xl:px-14">
        <TransactionsFilters
          filters={filters}
          onChange={setFilters}
          accounts={accounts}
          cards={cards}
        />

        <div className="mt-5">
          {loading ? (
            <p className="text-sm text-zinc-500">Carregando lançamentos...</p>
          ) : (
            <SoftPanel>
              <TransactionsTable
                transactions={transactions}
                accounts={accounts}
                cards={cards}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            </SoftPanel>
          )}
        </div>

        <p className="mt-4 text-xs text-zinc-500">
          Editar aqui corrige a descrição, categoria, valor ou data — mas não reajusta o saldo da conta.
        </p>
      </div>
    </PageShell>
  );
}
