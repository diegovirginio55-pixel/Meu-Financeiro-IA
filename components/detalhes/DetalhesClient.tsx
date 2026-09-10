"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import TransactionsFilters, { type FiltersState } from "./TransactionsFilters";
import TransactionsTable from "./TransactionsTable";
import { CategoryRulesPanel } from "./CategoryRulesPanel";
import type { Account, Card, Transaction } from "@/lib/finance/types";
import { formatCurrency, formatPercent } from "@/lib/finance/format";
import { isPlaceholderAccount, isPlaceholderCard } from "@/lib/finance/account-name";
import { CATEGORIES } from "@/lib/finance/categories";
import { HeroAmount, PageHero, PageShell, SoftPanel } from "@/components/ui/page-chrome";
import { usePersistedState } from "@/lib/ui/use-persisted-state";
import { exportTransactionsPdf } from "@/lib/finance/export-pdf";
import { exportTransactionsCsv } from "@/lib/finance/export-csv";

const PERIOD_LABELS: Record<FiltersState["period"], string> = {
  hoje: "Hoje",
  semana: "Esta semana",
  mes: "Este mês",
  ano: "Este ano",
  todos: "Todo o período",
};

const DEFAULT_FILTERS: FiltersState = {
  period: "mes",
  category: "",
  accountId: "",
  cardId: "",
  type: "",
  search: "",
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function matchesSearch(transaction: Transaction, search: string | undefined): boolean {
  const term = normalize((search ?? "").trim());
  if (!term) return true;
  if (normalize(transaction.description).includes(term)) return true;
  if (normalize(transaction.category).includes(term)) return true;
  const amountStr = String(transaction.amount).replace(".", ",");
  if (amountStr.includes(term.replace(".", ","))) return true;
  return false;
}

export default function DetalhesClient() {
  const searchParams = useSearchParams();
  const [filters, setFilters, filtersReady] = usePersistedState<FiltersState>("mf-detalhes-filters", DEFAULT_FILTERS);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState<string>(CATEGORIES[0]);
  const [bulkSaving, setBulkSaving] = useState(false);

  // Busca global (Ctrl+K) pode mandar pra cá com "?q=algo" pra já aplicar a busca.
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && filtersReady) {
      setFilters((prev) => ({ ...prev, search: q }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, filtersReady]);

  const load = useCallback(async (f: FiltersState) => {
    const params = new URLSearchParams();
    if (f.period !== "todos") params.set("period", f.period);
    if (f.category) params.set("category", f.category);
    if (f.accountId) params.set("account_id", f.accountId);
    if (f.cardId) params.set("card_id", f.cardId);
    if (f.type) params.set("type", f.type);

    try {
      const res = await fetch(`/api/transactions?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      setTransactions(data.transactions ?? []);
      setAccounts(data.accounts ?? []);
      setCards(data.cards ?? []);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(filters);
  }, [filters, filtersReady, load]);

  // Filtros de conta/cartão salvos localmente podem apontar para uma conta/cartão
  // "fantasma" (placeholder) que foi removido da lista de opções — isso zerava o
  // extrato silenciosamente. Corrige automaticamente voltando para "todas".
  useEffect(() => {
    if (accounts.length === 0 && cards.length === 0) return;
    let accountId = filters.accountId;
    let cardId = filters.cardId;
    if (accountId) {
      const account = accounts.find((a) => a.id === accountId);
      if (!account || isPlaceholderAccount(account)) accountId = "";
    }
    if (cardId) {
      const card = cards.find((c) => c.id === cardId);
      if (!card || isPlaceholderCard(card)) cardId = "";
    }
    if (accountId !== filters.accountId || cardId !== filters.cardId) {
      setFilters({ ...filters, accountId, cardId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, cards]);

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

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll(ids: string[], select: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (select ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  async function handleBulkCategorize() {
    if (selectedIds.size === 0) return;
    setBulkSaving(true);
    try {
      await fetch("/api/transactions/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), category: bulkCategory }),
      });
      setSelectedIds(new Set());
      await load(filters);
    } finally {
      setBulkSaving(false);
    }
  }

  function handleExportCsv() {
    exportTransactionsCsv({ transactions: filteredTransactions, accounts, cards });
  }

  async function handleExportPdf() {
    setExporting(true);
    try {
      await exportTransactionsPdf({
        title: `Extrato — ${PERIOD_LABELS[filters.period]}`,
        subtitle: filters.search ? `Busca: "${filters.search}"` : undefined,
        transactions: filteredTransactions,
        accounts,
        cards,
      });
    } finally {
      setExporting(false);
    }
  }

  const filteredTransactions = useMemo(
    () => transactions.filter((t) => matchesSearch(t, filters.search)),
    [transactions, filters.search],
  );

  const totalEntradas = filteredTransactions
    .filter((t) => t.type === "entrada")
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalSaidas = filteredTransactions
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
        subtitle={`${filteredTransactions.length} lançamentos neste filtro`}
        trailing={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredTransactions.length === 0}
              className="rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={() => void handleExportPdf()}
              disabled={exporting || filteredTransactions.length === 0}
              className="rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              {exporting ? "Gerando…" : "Exportar PDF"}
            </button>
          </div>
        }
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

        <CategoryRulesPanel onApplied={() => load(filters)} />

        {selectedIds.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-800/50 bg-emerald-950/20 p-3">
            <span className="text-xs text-emerald-200">{selectedIds.size} selecionado(s)</span>
            <select
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleBulkCategorize()}
              disabled={bulkSaving}
              className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {bulkSaving ? "Aplicando…" : "Aplicar categoria"}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              Limpar seleção
            </button>
          </div>
        )}

        <div className="mt-5">
          {loading ? (
            <p className="text-sm text-zinc-500">Carregando lançamentos...</p>
          ) : loadError ? (
            <SoftPanel>
              <p className="text-sm text-rose-400">
                Não foi possível carregar os lançamentos agora.{" "}
                <button
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    load(filters);
                  }}
                  className="font-medium underline underline-offset-2"
                >
                  Tentar de novo
                </button>
              </p>
            </SoftPanel>
          ) : (
            <SoftPanel>
              <TransactionsTable
                transactions={filteredTransactions}
                accounts={accounts}
                cards={cards}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onSelectAll={selectAll}
              />
            </SoftPanel>
          )}
        </div>

        <p className="mt-4 text-xs text-zinc-500">
          Editar ou excluir aqui já reajusta o saldo da conta ou a fatura do cartão vinculado automaticamente.
        </p>
      </div>
    </PageShell>
  );
}
