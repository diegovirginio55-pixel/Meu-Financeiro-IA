"use client";

import { useEffect, useMemo, useState } from "react";
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

const EMPTY_TRANSACTIONS: Transaction[] = [];
const EMPTY_ACCOUNTS: Account[] = [];
const EMPTY_CARDS: Card[] = [];
const EMPTY_SELECTION: Set<string> = new Set();

interface LoadedData {
  /** Filtros (do servidor) que geraram estes dados. */
  query: string;
  transactions: Transaction[];
  accounts: Account[];
  cards: Card[];
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
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

/** Só os filtros que vão para a API (a busca é feita no cliente e não dispara requisição). */
function serverQuery(f: FiltersState): string {
  const params = new URLSearchParams();
  if (f.period !== "todos") params.set("period", f.period);
  if (f.category) params.set("category", f.category);
  if (f.accountId) params.set("account_id", f.accountId);
  if (f.cardId) params.set("card_id", f.cardId);
  if (f.type) params.set("type", f.type);
  return params.toString();
}

async function readError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error || fallback;
}

export default function DetalhesClient() {
  const searchParams = useSearchParams();
  const [filters, setFilters, filtersReady] = usePersistedState<FiltersState>("mf-detalhes-filters", DEFAULT_FILTERS);
  const [data, setData] = useState<LoadedData | null>(null);
  const [failed, setFailed] = useState<{ query: string; token: number } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [selection, setSelection] = useState<{ key: string; ids: Set<string> } | null>(null);
  const [bulkCategory, setBulkCategory] = useState<string>(CATEGORIES[0]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = serverQuery(filters);
  const transactions = data?.transactions ?? EMPTY_TRANSACTIONS;
  const accounts = data?.accounts ?? EMPTY_ACCOUNTS;
  const cards = data?.cards ?? EMPTY_CARDS;
  // Trocou um filtro do servidor: mostra "carregando" até chegar a resposta desse filtro.
  const loadError = failed != null && failed.query === query && failed.token === reloadToken;
  const loading = !loadError && (data == null || data.query !== query);

  // A seleção vale só para os filtros em que foi feita (inclusive a busca): mudou o filtro, ela zera.
  const selectionKey = JSON.stringify(filters);
  const selectedIds = selection && selection.key === selectionKey ? selection.ids : EMPTY_SELECTION;

  // Busca global (Ctrl+K) pode mandar pra cá com "?q=algo" pra já aplicar a busca.
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && filtersReady) {
      setFilters((prev) => ({ ...prev, search: q }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, filtersReady]);

  // Busca os lançamentos. Depende só dos filtros do servidor (não da busca) e cancela a
  // requisição anterior: uma resposta antiga nunca sobrescreve a mais nova.
  useEffect(() => {
    if (!filtersReady) return;
    const controller = new AbortController();
    const token = reloadToken;
    fetch(`/api/transactions?${query}`, { cache: "no-store", signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((json: { transactions?: Transaction[]; accounts?: Account[]; cards?: Card[] }) => {
        setData({
          query,
          transactions: json.transactions ?? [],
          accounts: json.accounts ?? [],
          cards: json.cards ?? [],
        });
        setFailed(null);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setFailed({ query, token });
      });
    return () => controller.abort();
  }, [query, filtersReady, reloadToken]);

  function reload() {
    setReloadToken((value) => value + 1);
  }

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

  const filteredTransactions = useMemo(
    () => transactions.filter((t) => matchesSearch(t, filters.search)),
    [transactions, filters.search],
  );

  /** Lança erro com a mensagem da API — a tabela mantém a edição aberta e mostra o erro. */
  async function handleUpdate(id: string, patch: Record<string, unknown>) {
    let res: Response;
    try {
      res = await fetch(`/api/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch {
      throw new Error("Sem conexão. Tente salvar de novo.");
    }
    if (!res.ok) throw new Error(await readError(res, "Não foi possível salvar o lançamento."));
    // Mostra a alteração na hora e confirma com o servidor em segundo plano.
    setData((current) =>
      current && {
        ...current,
        transactions: current.transactions.map((t) => (t.id === id ? ({ ...t, ...patch } as Transaction) : t)),
      },
    );
    reload();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Excluir este lançamento? Isso também ajusta o saldo da conta ou a fatura do cartão.")) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setActionError(await readError(res, "Não foi possível excluir o lançamento."));
        return;
      }
    } catch {
      setActionError("Sem conexão. Não foi possível excluir o lançamento.");
      return;
    }
    setData((current) => current && { ...current, transactions: current.transactions.filter((t) => t.id !== id) });
    reload();
  }

  function updateSelection(update: (ids: Set<string>) => void) {
    const next = new Set(selectedIds);
    update(next);
    setSelection({ key: selectionKey, ids: next });
  }

  function toggleSelect(id: string) {
    updateSelection((next) => {
      if (next.has(id)) next.delete(id);
      else next.add(id);
    });
  }

  function selectAll(ids: string[], select: boolean) {
    updateSelection((next) => {
      ids.forEach((id) => (select ? next.add(id) : next.delete(id)));
    });
  }

  async function handleBulkCategorize() {
    // Só os selecionados que estão visíveis neste filtro.
    const visibleIds = new Set(filteredTransactions.map((t) => t.id));
    const ids = Array.from(selectedIds).filter((id) => visibleIds.has(id));
    if (ids.length === 0) return;
    setBulkSaving(true);
    setActionError(null);
    try {
      const res = await fetch("/api/transactions/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, category: bulkCategory }),
      });
      if (!res.ok) {
        setActionError(await readError(res, "Não foi possível aplicar a categoria."));
        return;
      }
      setSelection(null);
      reload();
    } catch {
      setActionError("Sem conexão. Não foi possível aplicar a categoria.");
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
        subtitle={loading ? "Carregando lançamentos…" : `${filteredTransactions.length} lançamentos neste filtro`}
        trailing={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={loading || filteredTransactions.length === 0}
              className="rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={() => void handleExportPdf()}
              disabled={loading || exporting || filteredTransactions.length === 0}
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

        <CategoryRulesPanel onApplied={reload} />

        {actionError && (
          <p role="alert" className="mt-3 rounded-2xl border border-rose-900/60 bg-rose-950/30 p-3 text-sm text-rose-300">
            {actionError}
          </p>
        )}

        {selectedIds.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-800/50 bg-emerald-950/20 p-3">
            <span className="text-xs text-emerald-200">{selectedIds.size} selecionado(s)</span>
            <select
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
              aria-label="Categoria para os selecionados"
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
              onClick={() => setSelection(null)}
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              Limpar seleção
            </button>
          </div>
        )}

        <div className="mt-5">
          {loadError ? (
            <SoftPanel>
              <p role="alert" className="p-4 text-sm text-rose-400">
                Não foi possível carregar os lançamentos agora.{" "}
                <button
                  type="button"
                  onClick={reload}
                  className="font-medium underline underline-offset-2"
                >
                  Tentar de novo
                </button>
              </p>
            </SoftPanel>
          ) : loading ? (
            <p className="text-sm text-zinc-500" aria-live="polite">
              Carregando lançamentos…
            </p>
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
