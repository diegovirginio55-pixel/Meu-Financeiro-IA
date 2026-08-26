"use client";

import { useMemo } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency, formatDate, formatPercent } from "@/lib/finance/format";
import { accountBankLabel, cardBankLabel, isPlaceholderAccount, isPlaceholderCard } from "@/lib/finance/account-name";
import { CATEGORY_ICONS, categoryColor, resolvedCategory } from "@/lib/finance/categories";
import {
  belongsToConnection,
  futureExpensesInMonth,
  isGasto,
  isRenda,
  saoPauloMonthKey,
} from "@/lib/finance/fluxo";
import type { BankConnectionWithAssets } from "@/lib/finance/bank-connections";
import type { Account, Card, Debt, RecurringItem, Transaction } from "@/lib/finance/types";
import { officialInstitutionName } from "@/lib/pluggy/brands";
import { FluxoAreaChart, FluxoDonutChart } from "@/components/fluxo/FluxoCharts";
import { assetMatchesBank, connectionBank, realConnectionId } from "@/lib/finance/connection-filter";
import {
  BalanceViewToggle,
  HeroAmount,
  PageHero,
  PageShell,
  SectionLabel,
  SoftPanel,
  chipClass,
  useBalanceView,
} from "@/components/ui/page-chrome";
import { useConnectionFilter, usePersistedState } from "@/lib/ui/use-persisted-state";

function monthTitle(month: Date): string {
  const raw = format(month, "MMMM 'de' yyyy", { locale: ptBR });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8v4.2L15 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function FluxoClient({
  transactions,
  accounts,
  cards,
  connections,
  recurring,
  debts,
}: {
  transactions: Transaction[];
  accounts: Account[];
  cards: Card[];
  connections: BankConnectionWithAssets[];
  recurring: RecurringItem[];
  debts: Debt[];
}) {
  const connectionIds = useMemo(() => connections.map((connection) => connection.id), [connections]);
  const [connectionId, setConnectionId] = useConnectionFilter(connectionIds);
  const [monthKey, setMonthKey] = usePersistedState("mf-fluxo-month", saoPauloMonthKey());
  const [accountId, setAccountId] = usePersistedState("mf-fluxo-account", "all");
  const [type, setType] = usePersistedState<"todos" | "entrada" | "saida">("mf-fluxo-type", "todos");
  const [search, setSearch] = usePersistedState("mf-fluxo-search", "");
  const [balanceView, setBalanceView] = useBalanceView();

  const month = useMemo(() => {
    const parsed = parseISO(`${monthKey}-01`);
    return Number.isNaN(parsed.getTime()) ? startOfMonth(new Date()) : startOfMonth(parsed);
  }, [monthKey]);

  const scoped = useMemo(() => {
    return transactions.filter((transaction) => {
      if (!transaction.date.startsWith(monthKey)) return false;
      if (!belongsToConnection(transaction, connectionId, accounts, cards)) return false;
      if (accountId !== "all") {
        if (transaction.account_id !== accountId && transaction.card_id !== accountId) return false;
      }
      if (type !== "todos" && transaction.type !== type) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!transaction.description.toLowerCase().includes(q) && !transaction.category.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [transactions, monthKey, connectionId, accounts, cards, accountId, type, search]);

  const entradas = scoped
    .filter(isRenda)
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const despesas = scoped
    .filter(isGasto)
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const movimento = entradas + despesas;
  const pctEntradas = movimento > 0 ? (entradas / movimento) * 100 : 0;
  const pctSaidas = movimento > 0 ? (despesas / movimento) * 100 : 0;

  const categorias = useMemo(() => {
    const map = new Map<string, number>();
    scoped.filter(isGasto).forEach((transaction) => {
      const category = resolvedCategory(transaction);
      map.set(category, (map.get(category) ?? 0) + Number(transaction.amount));
    });
    return Array.from(map.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [scoped]);

  const daily = useMemo(() => {
    const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
    const buckets = new Map(days.map((day) => [format(day, "yyyy-MM-dd"), { entradas: 0, despesas: 0 }]));
    scoped.forEach((transaction) => {
      const bucket = buckets.get(transaction.date);
      if (!bucket) return;
      if (isRenda(transaction)) bucket.entradas += Number(transaction.amount);
      else if (isGasto(transaction)) bucket.despesas += Number(transaction.amount);
    });
    return days.map((day) => {
      const key = format(day, "yyyy-MM-dd");
      const bucket = buckets.get(key)!;
      return {
        dia: format(day, "d"),
        entradas: bucket.entradas,
        despesas: bucket.despesas,
      };
    });
  }, [month, scoped]);

  const futuras = useMemo(
    () => futureExpensesInMonth(month, recurring, debts),
    [month, recurring, debts],
  );

  const visibleAccounts = useMemo(() => {
    const realId = connectionId === "all" ? null : realConnectionId(connectionId);
    const bank = connectionId === "all" ? null : connectionBank(connectionId);
    const list = accounts.filter((account) => {
      if (isPlaceholderAccount(account)) return false;
      if (!realId) return true;
      if (account.bank_connection_id !== realId) return false;
      return assetMatchesBank(account.name, bank);
    });
    const cardList = cards.filter((card) => {
      if (isPlaceholderCard(card)) return false;
      if (!realId) return true;
      if (card.bank_connection_id !== realId) return false;
      return assetMatchesBank(card.name, bank);
    });
    return { list, cardList };
  }, [accounts, cards, connectionId]);

  const visibleConnections = useMemo(() => {
    if (connectionId === "all") return connections;
    return connections.filter((connection) => connection.id === connectionId);
  }, [connectionId, connections]);
  const saldoConta = visibleConnections
    .flatMap((connection) => connection.accounts)
    .reduce((sum, account) => sum + Number(account.balance), 0);
  const saldoInvestido = visibleConnections
    .flatMap((connection) => connection.investments)
    .reduce((sum, investment) => sum + Number(investment.amount), 0);
  const displayedBalance = balanceView === "total" ? saldoConta + saldoInvestido : saldoConta;

  return (
    <PageShell>
      <PageHero
        kicker="Fluxo"
        title={<HeroAmount>{formatCurrency(displayedBalance)}</HeroAmount>}
        trailing={
          <label className="rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-300">
            <select
              value={connectionId}
              onChange={(event) => {
                setConnectionId(event.target.value);
                setAccountId("all");
              }}
              className="bg-transparent outline-none"
            >
              <option value="all">Tudo</option>
              {connections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {officialInstitutionName(connection.institution_name)}
                </option>
              ))}
            </select>
          </label>
        }
      >
        <BalanceViewToggle value={balanceView} onChange={setBalanceView} />
        <div className="mt-6">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">
            {monthTitle(month)} · entradas menos saídas
          </p>
          <div className="mb-1.5 flex justify-between text-[11px]">
            <span className="font-medium text-emerald-300">{formatPercent(pctEntradas, 1)}</span>
            <span className="font-medium text-rose-300">{formatPercent(pctSaidas, 1)}</span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full shrink-0 bg-emerald-400" style={{ width: `${pctEntradas}%` }} />
            <div className="h-full shrink-0 bg-rose-400" style={{ width: `${pctSaidas}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-zinc-500">
            <span className="text-emerald-300">{formatCurrency(entradas)}</span>
            <span className="text-rose-300">{formatCurrency(despesas)}</span>
          </div>
        </div>
      </PageHero>

      <div className="flex flex-col gap-6 px-4 pb-2 lg:gap-8 lg:px-6 xl:px-10 2xl:px-14">
      <div className="grid gap-4 lg:grid-cols-3">
        <SoftPanel className="p-4 lg:col-span-2 lg:p-6">
          <SectionLabel>Movimentação do mês</SectionLabel>
          <FluxoAreaChart data={daily} />
        </SoftPanel>
        <SoftPanel className="p-4 lg:p-6">
          <SectionLabel>Composição das despesas</SectionLabel>
          <FluxoDonutChart data={categorias} />
        </SoftPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SoftPanel className="p-5">
          <SectionLabel>Despesas</SectionLabel>
          <p className="text-3xl font-semibold tracking-tight text-rose-300">{formatCurrency(despesas)}</p>
          <p className="mt-1 text-xs text-zinc-500">por categoria neste mês</p>
          <div className="mt-5 flex flex-col gap-3">
            {categorias.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhuma despesa neste mês.</p>
            ) : (
              categorias.map((item) => {
                const share = despesas > 0 ? (item.total / despesas) * 100 : 0;
                const width = Math.max(6, share);
                return (
                  <div key={item.category}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2 text-zinc-200">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-sm">
                          {CATEGORY_ICONS[item.category] ?? "🔖"}
                        </span>
                        <span className="truncate">{item.category}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-medium text-zinc-100">{formatCurrency(item.total)}</span>
                        <span className="text-[11px] text-zinc-500">{share.toFixed(0)}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${width}%`, backgroundColor: categoryColor(item.category) }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SoftPanel>

        <SoftPanel className="flex min-h-[260px] flex-col p-5">
          {futuras.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <span className="text-zinc-600">
                <ClockIcon />
              </span>
              <p className="mt-3 text-sm font-medium text-zinc-200">Despesas futuras</p>
              <p className="mt-1 text-sm text-zinc-500">Nenhuma despesa futura encontrada.</p>
            </div>
          ) : (
            <>
              <SectionLabel>Despesas futuras</SectionLabel>
              <ul className="mt-4 flex flex-col gap-2">
                {futuras.map((item) => (
                  <li key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300">
                      {formatDate(item.date)} — {item.description}
                    </span>
                    <span className="font-medium text-red-400">{formatCurrency(item.amount)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </SoftPanel>
      </div>

      <SoftPanel className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMonthKey(format(addMonths(month, -1), "yyyy-MM"))}
                className="rounded-full border border-zinc-800 px-2 py-1 text-zinc-400 hover:text-white"
              >
                ‹
              </button>
              <p className="min-w-[180px] text-center text-sm font-medium text-zinc-100">
                {monthTitle(month)}
              </p>
              <button
                type="button"
                onClick={() => setMonthKey(format(addMonths(month, 1), "yyyy-MM"))}
                className="rounded-full border border-zinc-800 px-2 py-1 text-zinc-400 hover:text-white"
              >
                ›
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="text-emerald-400">↘ {formatCurrency(entradas)}</span>
              <span className="text-red-400">↗ {formatCurrency(despesas)}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
              <span className="text-zinc-500">⌕</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar transação..."
                className="w-full bg-transparent text-zinc-100 outline-none placeholder:text-zinc-600"
              />
            </label>
            <select
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
            >
              <option value="all">Todas contas</option>
              {visibleAccounts.list.map((account) => (
                <option key={account.id} value={account.id}>
                  {accountBankLabel(account)}
                </option>
              ))}
              {visibleAccounts.cardList.map((card) => (
                <option key={card.id} value={card.id}>
                  {cardBankLabel(card)}
                </option>
              ))}
            </select>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(
                [
                  ["todos", "Todos"],
                  ["entrada", "Entradas"],
                  ["saida", "Saídas"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className={chipClass(type === value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <ul className="mt-4 divide-y divide-zinc-800/80">
          {scoped.length === 0 ? (
            <li className="py-8 text-center text-sm text-zinc-500">Nenhuma movimentação neste filtro.</li>
          ) : (
            scoped.slice(0, 40).map((transaction) => (
              <li key={transaction.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-zinc-100">{transaction.description}</p>
                  <p className="text-xs text-zinc-500">
                    {formatDate(transaction.date)} · {resolvedCategory(transaction)}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-medium ${
                    transaction.type === "entrada" ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {transaction.type === "entrada" ? "+" : "-"}
                  {formatCurrency(Number(transaction.amount))}
                </span>
              </li>
            ))
          )}
        </ul>
        {scoped.length > 40 && (
          <p className="mt-2 text-center text-xs text-zinc-500">Mostrando as 40 movimentações mais recentes.</p>
        )}
      </SoftPanel>
      </div>
    </PageShell>
  );
}
