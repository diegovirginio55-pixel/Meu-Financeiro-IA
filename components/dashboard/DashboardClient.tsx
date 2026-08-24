"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, startOfMonth, subMonths } from "date-fns";
import { formatCurrency } from "@/lib/finance/format";
import { belongsToConnection, isGasto } from "@/lib/finance/fluxo";
import type { FinancialSnapshot } from "@/lib/finance/summary";
import type { BankConnectionWithAssets } from "@/lib/finance/bank-connections";
import type { Transaction } from "@/lib/finance/types";
import { officialInstitutionName } from "@/lib/pluggy/brands";
import { BankLogo } from "@/components/bancos/BankLogo";
import {
  FluxoBarrasChart,
  GastosDonutChart,
  SaldoEvolutionChart,
} from "@/components/dashboard/OverviewCharts";
import { GoalsProgress, MaioresGastos, ProximasContas } from "@/components/dashboard/ListPanels";

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BankIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path d="M4 10h16M6 10v8M10 10v8M14 10v8M18 10v8M3 18h18M12 4 4 9h16L12 4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path d="M4 16 9.5 10.5 13 14l7-8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path d="M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 8V6.5A2.5 2.5 0 0 1 9.5 4h5A2.5 2.5 0 0 1 17 6.5V8" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function lastFour(name: string): string | null {
  const match = name.match(/(\d{4})\s*$/);
  return match ? `xxxx ${match[1]}` : null;
}

function cardDisplayName(name: string): string {
  return name.replace(/[·•]\s*\d{4}\s*$/, "").replace(/^.*?\s[·•]\s*/, "").trim() || name;
}

export default function DashboardClient({
  snapshot,
  connections,
  historyTx,
}: {
  snapshot: FinancialSnapshot;
  connections: BankConnectionWithAssets[];
  historyTx: Transaction[];
}) {
  const [connectionId, setConnectionId] = useState("all");
  const [openBanks, setOpenBanks] = useState<Set<string>>(new Set());
  const [investTab, setInvestTab] = useState<"classes" | "instituicoes">("classes");

  const visibleConnections = useMemo(() => {
    if (connectionId === "all") return connections;
    return connections.filter((connection) => connection.id === connectionId);
  }, [connectionId, connections]);

  const accounts = visibleConnections.flatMap((connection) => connection.accounts);
  const cards = visibleConnections.flatMap((connection) => connection.cards);
  const investments = visibleConnections.flatMap((connection) => connection.investments);

  const totalBalance = accounts.reduce((sum, account) => sum + Number(account.balance), 0);
  const totalInvoices = cards.reduce((sum, card) => sum + Number(card.current_invoice), 0);
  const totalLimit = cards.reduce((sum, card) => sum + Number(card.credit_limit ?? 0), 0);
  const totalInvestments = investments.reduce((sum, investment) => sum + Number(investment.amount), 0);
  const usedLimitPct = totalLimit > 0 ? (totalInvoices / totalLimit) * 100 : 0;

  const scopedTx = useMemo(
    () => historyTx.filter((transaction) => belongsToConnection(transaction, connectionId, snapshot.accounts, snapshot.cards)),
    [historyTx, connectionId, snapshot.accounts, snapshot.cards],
  );

  const monthKey = format(startOfMonth(new Date()), "yyyy-MM");
  const monthTx = scopedTx.filter((transaction) => transaction.date.startsWith(monthKey));
  const monthEntradas = monthTx
    .filter((transaction) => transaction.type === "entrada")
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const monthDespesas = monthTx.filter(isGasto).reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const economia = monthEntradas - monthDespesas;
  const patrimonio = totalBalance + totalInvestments - totalInvoices - snapshot.totalDebts;

  const gastosPorCategoria = useMemo(() => {
    const map = new Map<string, number>();
    monthTx.filter(isGasto).forEach((transaction) => {
      map.set(transaction.category, (map.get(transaction.category) ?? 0) + Number(transaction.amount));
    });
    return Array.from(map.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [monthTx]);

  const evolucaoMensal = useMemo(() => {
    const now = new Date();
    const map = new Map<string, { entradas: number; despesas: number }>();
    for (let i = 11; i >= 0; i -= 1) {
      map.set(format(startOfMonth(subMonths(now, i)), "yyyy-MM"), { entradas: 0, despesas: 0 });
    }
    scopedTx.forEach((transaction) => {
      const bucket = map.get(transaction.date.slice(0, 7));
      if (!bucket) return;
      if (transaction.type === "entrada") bucket.entradas += Number(transaction.amount);
      else if (isGasto(transaction)) bucket.despesas += Number(transaction.amount);
    });
    return Array.from(map.entries()).map(([mes, values]) => ({ mes, ...values }));
  }, [scopedTx]);

  const evolucaoSaldo = useMemo(() => {
    const now = new Date();
    const nets = new Map<string, number>();
    for (let i = 0; i < 12; i += 1) {
      nets.set(format(startOfMonth(subMonths(now, i)), "yyyy-MM"), 0);
    }
    scopedTx.forEach((transaction) => {
      const key = transaction.date.slice(0, 7);
      if (!nets.has(key)) return;
      const delta = transaction.type === "entrada" ? Number(transaction.amount) : -Number(transaction.amount);
      nets.set(key, (nets.get(key) ?? 0) + delta);
    });
    const points: { mes: string; saldo: number; patrimonio: number }[] = [];
    let saldo = totalBalance;
    let patr = patrimonio;
    for (let i = 0; i < 12; i += 1) {
      const mes = format(startOfMonth(subMonths(now, i)), "yyyy-MM");
      points.push({ mes, saldo, patrimonio: patr });
      const net = nets.get(mes) ?? 0;
      saldo -= net;
      patr -= net;
    }
    return points.reverse();
  }, [scopedTx, totalBalance, patrimonio]);

  const bankGroups = visibleConnections
    .map((connection) => {
      const name = officialInstitutionName(connection.institution_name);
      const balance = connection.accounts.reduce((sum, account) => sum + Number(account.balance), 0);
      return {
        id: connection.id,
        name,
        imageUrl: connection.institution_image_url,
        accounts: connection.accounts,
        balance,
        share: totalBalance > 0 ? (balance / totalBalance) * 100 : 0,
      };
    })
    .filter((group) => group.accounts.length > 0)
    .sort((a, b) => b.balance - a.balance);

  const investClasses = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    investments.forEach((investment) => {
      const key = investment.type || "Outros";
      const current = map.get(key) ?? { count: 0, total: 0 };
      current.count += 1;
      current.total += Number(investment.amount);
      map.set(key, current);
    });
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, ...value, share: totalInvestments > 0 ? (value.total / totalInvestments) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [investments, totalInvestments]);

  const investInstitutions = useMemo(() => {
    return visibleConnections
      .map((connection) => {
        const total = connection.investments.reduce((sum, investment) => sum + Number(investment.amount), 0);
        return {
          id: connection.id,
          name: officialInstitutionName(connection.institution_name),
          imageUrl: connection.institution_image_url,
          count: connection.investments.length,
          total,
          share: totalInvestments > 0 ? (total / totalInvestments) * 100 : 0,
        };
      })
      .filter((item) => item.count > 0)
      .sort((a, b) => b.total - a.total);
  }, [visibleConnections, totalInvestments]);

  const activeInvestments = investments.filter((investment) => Number(investment.amount) > 0).length;
  const inactiveInvestments = investments.length - activeInvestments;

  function toggleBank(id: string) {
    setOpenBanks((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-white">Visão Geral</h1>
          <p className="mt-2 text-sm text-zinc-400">Sua situação financeira, atualizada em tempo real.</p>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-[#141414] px-3 py-2 text-sm text-zinc-200">
          <span className="text-zinc-500">
            <FilterIcon />
          </span>
          <select
            value={connectionId}
            onChange={(event) => setConnectionId(event.target.value)}
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

      {connections.length === 0 && (
        <Link
          href="/bancos"
          className="rounded-2xl border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-100 transition-colors hover:border-emerald-600"
        >
          <p className="font-medium text-emerald-50">Nenhum banco neste painel</p>
          <p className="mt-1 text-emerald-200/80">Conecte o Meu Pluggy na aba Bancos para importar saldo, cartões e investimentos.</p>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Patrimônio", patrimonio, "text-white"],
          ["Entradas (mês)", monthEntradas, "text-emerald-400"],
          ["Despesas (mês)", monthDespesas, "text-red-400"],
          ["Economia (mês)", economia, economia >= 0 ? "text-emerald-400" : "text-red-400"],
        ].map(([label, value, tone]) => (
          <div key={String(label)} className="rounded-2xl border border-zinc-800 bg-[#141414] px-4 py-3">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className={`mt-1 text-lg font-semibold ${tone}`}>{formatCurrency(Number(value))}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-zinc-800 bg-[#141414] p-4">
          <div className="flex items-center gap-2 text-xs font-medium tracking-[0.14em] text-red-400">
            <BankIcon />
            CONTAS BANCÁRIAS
          </div>
          <p className="mt-2 text-3xl font-semibold text-white">{formatCurrency(totalBalance)}</p>
          <div className="mt-4 flex flex-col">
            {bankGroups.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhuma conta importada.</p>
            ) : (
              bankGroups.map((group) => {
                const open = openBanks.has(group.id);
                return (
                  <div key={group.id} className="border-t border-zinc-800/80">
                    <button
                      type="button"
                      onClick={() => toggleBank(group.id)}
                      className="flex w-full items-center gap-3 py-3 text-left"
                    >
                      <BankLogo name={group.name} imageUrl={group.imageUrl} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-zinc-100">{group.name}</span>
                        <span className="text-xs text-zinc-500">
                          {group.accounts.length} {group.accounts.length === 1 ? "conta" : "contas"} · {group.share.toFixed(1)}%
                        </span>
                      </span>
                      <span className="text-sm font-medium text-emerald-400">{formatCurrency(group.balance)}</span>
                      <span className={`text-zinc-500 ${open ? "rotate-180" : ""}`}>⌄</span>
                    </button>
                    {open && (
                      <ul className="pb-3 pl-8">
                        {group.accounts.map((account) => (
                          <li key={account.id} className="flex justify-between py-1 text-xs text-zinc-400">
                            <span>{account.name}</span>
                            <span className="text-emerald-400">{formatCurrency(Number(account.balance))}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-[#141414] p-4">
          <div className="flex items-center gap-2 text-xs font-medium tracking-[0.14em] text-red-400">
            <CardIcon />
            CARTÕES DE CRÉDITO
          </div>
          <p className="mt-2 text-3xl font-semibold text-red-400">{formatCurrency(totalInvoices)}</p>
          <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
            <span>{usedLimitPct.toFixed(0)}% utilizado</span>
            <span>Limite: {formatCurrency(totalLimit)}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.min(100, usedLimitPct)}%` }} />
          </div>
          <div className="mt-4 flex flex-col">
            {cards.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhum cartão importado.</p>
            ) : (
              cards.map((card) => (
                <div key={card.id} className="flex items-center gap-3 border-t border-zinc-800/80 py-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400">
                    <CardIcon />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-zinc-100">{cardDisplayName(card.name)}</span>
                    <span className="text-xs text-zinc-500">{lastFour(card.name) ?? "Cartão"}</span>
                  </span>
                  <span className="text-sm font-medium text-red-400">
                    {formatCurrency(Number(card.current_invoice))}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-[#141414] p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-medium tracking-[0.14em] text-red-400">
              <TrendIcon />
              INVESTIMENTOS
            </div>
            <div className="flex rounded-full bg-zinc-900 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setInvestTab("classes")}
                className={`rounded-full px-2.5 py-1 ${investTab === "classes" ? "bg-red-500 text-white" : "text-zinc-400"}`}
              >
                Classes
              </button>
              <button
                type="button"
                onClick={() => setInvestTab("instituicoes")}
                className={`rounded-full px-2.5 py-1 ${investTab === "instituicoes" ? "bg-red-500 text-white" : "text-zinc-400"}`}
              >
                Instituições
              </button>
            </div>
          </div>
          <p className="mt-2 text-3xl font-semibold text-emerald-400">{formatCurrency(totalInvestments)}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {investClasses.length} {investClasses.length === 1 ? "classe" : "classes"} · {investments.length}{" "}
            {investments.length === 1 ? "ativo" : "ativos"} ({activeInvestments} ativos, {inactiveInvestments} inativos)
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {(investTab === "classes" ? investClasses : investInstitutions).length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhum investimento importado.</p>
            ) : investTab === "classes" ? (
              investClasses.map((item) => (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-zinc-200">
                      {item.label} ({item.count})
                    </span>
                    <span className="text-zinc-400">
                      {item.share.toFixed(1)}% · {formatCurrency(item.total)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.max(8, item.share)}%` }} />
                  </div>
                </div>
              ))
            ) : (
              investInstitutions.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <BankLogo name={item.name} imageUrl={item.imageUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-200">{item.name}</span>
                      <span className="text-emerald-400">{formatCurrency(item.total)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                      <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.max(8, item.share)}%` }} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-zinc-800 bg-[#141414] p-4">
        <div className="flex items-center gap-2 text-xs font-medium tracking-[0.14em] text-red-400">
          <WalletIcon />
          EVOLUÇÃO DO SALDO
        </div>
        <p className="mt-2 text-3xl font-semibold text-white">{formatCurrency(totalBalance)}</p>
        <p className="mt-1 text-xs text-zinc-500">Linha vermelha: saldo em contas · pontilhada: patrimônio</p>
        <div className="mt-2">
          <SaldoEvolutionChart data={evolucaoSaldo} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-zinc-800 bg-[#141414] p-4 lg:col-span-2">
          <h2 className="mb-2 text-sm font-medium text-zinc-300">Entradas x despesas (12 meses)</h2>
          <FluxoBarrasChart data={evolucaoMensal} />
        </section>
        <section className="rounded-2xl border border-zinc-800 bg-[#141414] p-4">
          <h2 className="mb-2 text-sm font-medium text-zinc-300">Gastos por categoria</h2>
          <GastosDonutChart data={gastosPorCategoria} />
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MaioresGastos items={snapshot.maioresGastos.filter((item) => belongsToConnection(item, connectionId, snapshot.accounts, snapshot.cards))} />
        <ProximasContas items={snapshot.proximos30Dias} saldoPrevisto={snapshot.saldoPrevisto30Dias} />
      </div>

      <GoalsProgress goals={snapshot.goals} />
    </div>
  );
}
