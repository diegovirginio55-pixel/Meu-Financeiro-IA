"use client";

import { useMemo, useState } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency, formatDate } from "@/lib/finance/format";
import { categoryColor } from "@/lib/finance/categories";
import {
  belongsToConnection,
  futureExpensesInMonth,
  isGasto,
} from "@/lib/finance/fluxo";
import type { Account, BankConnection, Card, Debt, RecurringItem, Transaction } from "@/lib/finance/types";
import { officialInstitutionName } from "@/lib/pluggy/brands";
import { FluxoAreaChart, FluxoDonutChart } from "@/components/fluxo/FluxoCharts";
import { assetMatchesBank, connectionBank, realConnectionId } from "@/lib/finance/connection-filter";

function monthTitle(month: Date): string {
  const raw = format(month, "MMMM 'de' yyyy", { locale: ptBR });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path
        d="M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M7 8V6.5A2.5 2.5 0 0 1 9.5 4h5A2.5 2.5 0 0 1 17 6.5V8" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.5" cy="13" r="1" fill="currentColor" />
    </svg>
  );
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
  connections: BankConnection[];
  recurring: RecurringItem[];
  debts: Debt[];
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [connectionId, setConnectionId] = useState("all");
  const [accountId, setAccountId] = useState("all");
  const [type, setType] = useState<"todos" | "entrada" | "saida">("todos");
  const [search, setSearch] = useState("");

  const monthKey = format(month, "yyyy-MM");

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
    .filter((transaction) => transaction.type === "entrada")
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const despesas = scoped
    .filter(isGasto)
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

  const categorias = useMemo(() => {
    const map = new Map<string, number>();
    scoped.filter(isGasto).forEach((transaction) => {
      map.set(transaction.category, (map.get(transaction.category) ?? 0) + Number(transaction.amount));
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
      if (transaction.type === "entrada") bucket.entradas += Number(transaction.amount);
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
      if (!realId) return true;
      if (account.bank_connection_id !== realId) return false;
      return assetMatchesBank(account.name, bank);
    });
    const cardList = cards.filter((card) => {
      if (!realId) return true;
      if (card.bank_connection_id !== realId) return false;
      return assetMatchesBank(card.name, bank);
    });
    return { list, cardList };
  }, [accounts, cards, connectionId]);

  return (
    <div className="flex flex-col gap-6 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-white">Fluxo de Caixa</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Despesas, receitas e movimentações das suas contas.
          </p>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-[#141414] px-3 py-2 text-sm text-zinc-200">
          <span className="text-zinc-500">
            <FilterIcon />
          </span>
          <select
            value={connectionId}
            onChange={(event) => {
              setConnectionId(event.target.value);
              setAccountId("all");
            }}
            className="bg-transparent text-sm text-zinc-100 outline-none"
          >
            <option value="all">Todas conexões</option>
            {connections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {officialInstitutionName(connection.institution_name)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-zinc-800 bg-[#141414] p-4 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-300">Movimentação do mês</h2>
            <p className="text-xs text-zinc-500">Entradas vs despesas por dia</p>
          </div>
          <FluxoAreaChart data={daily} />
        </section>
        <section className="rounded-2xl border border-zinc-800 bg-[#141414] p-4">
          <h2 className="text-sm font-medium text-zinc-300">Composição das despesas</h2>
          <FluxoDonutChart data={categorias} />
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-800 bg-[#141414] p-5">
          <div className="flex items-center gap-2 text-xs font-medium tracking-[0.14em] text-red-400">
            <WalletIcon />
            DESPESAS
          </div>
          <p className="mt-2 text-3xl font-semibold text-red-400">{formatCurrency(despesas)}</p>
          <p className="mt-1 text-xs text-zinc-500">Transações categorizadas</p>
          <div className="mt-5 flex flex-col gap-3">
            {categorias.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhuma despesa neste mês.</p>
            ) : (
              categorias.map((item) => {
                const width = despesas > 0 ? Math.max(6, (item.total / despesas) * 100) : 0;
                return (
                  <div key={item.category}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-zinc-300">{item.category}</span>
                      <span className="text-zinc-200">{formatCurrency(item.total)}</span>
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
        </section>

        <section className="flex min-h-[260px] flex-col rounded-2xl border border-zinc-800 bg-[#141414] p-5">
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
              <p className="text-sm font-medium text-zinc-200">Despesas futuras</p>
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
        </section>
      </div>

      <section className="rounded-2xl border border-zinc-800 bg-[#141414] p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMonth((current) => addMonths(current, -1))}
                className="rounded-full border border-zinc-800 px-2 py-1 text-zinc-400 hover:text-white"
              >
                ‹
              </button>
              <p className="min-w-[180px] text-center text-sm font-medium text-zinc-100">
                {monthTitle(month)}
              </p>
              <button
                type="button"
                onClick={() => setMonth((current) => addMonths(current, 1))}
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
                  {account.name}
                </option>
              ))}
              {visibleAccounts.cardList.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </select>
            <div className="flex rounded-full bg-zinc-950 p-1">
              {(
                [
                  ["todos", "Todos"],
                  ["entrada", "Entradas"],
                  ["saida", "Saídas"],
                ] as const
              ).map(([value, label]) => {
                const active = type === value;
                const tone =
                  value === "entrada"
                    ? "bg-emerald-600 text-white"
                    : value === "saida"
                      ? "bg-red-500 text-white"
                      : "bg-red-500 text-white";
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                      active ? tone : "text-zinc-400 hover:text-zinc-100"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
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
                    {formatDate(transaction.date)} · {transaction.category}
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
      </section>
    </div>
  );
}
