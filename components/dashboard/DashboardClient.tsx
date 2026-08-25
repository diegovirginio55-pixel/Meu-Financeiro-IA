"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/finance/format";
import { friendlyAccountName } from "@/lib/finance/account-name";
import {
  belongsToConnection,
  dailyBudgetFromBalance,
  isGasto,
  isRenda,
  lastNDateKeys,
  lastNMonthKeys,
  saoPauloMonthKey,
  saoPauloTodayKey,
  saoPauloWeekStartKey,
  sumGastosInRange,
} from "@/lib/finance/fluxo";
import { isTransferDescription, resolvedCategory } from "@/lib/finance/categories";
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
import { EconomiaMensalChart, FluxoDiarioChart, MixPizzaChart, SemanaGastosChart } from "@/components/dashboard/ExtraCharts";
import { LucroAtivosPanel } from "@/components/dashboard/LucroAtivosPanel";
import { GoalsProgress, MaioresGastos, ProximasContas } from "@/components/dashboard/ListPanels";
import type { InvestmentSnapshot, InvestmentTxn } from "@/lib/finance/types";
import { BalanceViewToggle, HeroAmount, PageHero, PageShell, SectionLabel, SoftPanel, useBalanceView } from "@/components/ui/page-chrome";

function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.7" />
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
  snapshots = [],
  investmentTx = [],
}: {
  snapshot: FinancialSnapshot;
  connections: BankConnectionWithAssets[];
  historyTx: Transaction[];
  snapshots?: InvestmentSnapshot[];
  investmentTx?: InvestmentTxn[];
}) {
  const [connectionId, setConnectionId] = useState("all");
  const [openBanks, setOpenBanks] = useState<Set<string>>(new Set());
  const [investTab, setInvestTab] = useState<"classes" | "instituicoes">("classes");
  const [balanceView, setBalanceView] = useBalanceView();
  const router = useRouter();

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") router.refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

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

  const monthKey = saoPauloMonthKey();
  const monthTx = scopedTx.filter((transaction) => transaction.date.startsWith(monthKey));
  const monthEntradas = monthTx
    .filter(isRenda)
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const monthDespesas = monthTx.filter(isGasto).reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const todayKey = saoPauloTodayKey();
  const weekStart = saoPauloWeekStartKey();
  const gastosHoje = sumGastosInRange(scopedTx, todayKey, todayKey);
  const gastosSemana = sumGastosInRange(scopedTx, weekStart, todayKey);
  const patrimonio = totalBalance + totalInvestments - totalInvoices - snapshot.totalDebts;
  const saldoConta = totalBalance;
  const saldoTotal = totalBalance + totalInvestments;
  const displayedBalance = balanceView === "total" ? saldoTotal : saldoConta;
  const dailyBudget = dailyBudgetFromBalance(saldoConta, todayKey);
  const dailyUntilLabel = format(parseISO(`${dailyBudget.until}T12:00:00`), "d 'de' MMMM", { locale: ptBR });

  const gastosPorCategoria = useMemo(() => {
    const map = new Map<string, number>();
    monthTx.filter(isGasto).forEach((transaction) => {
      const category = resolvedCategory(transaction);
      map.set(category, (map.get(category) ?? 0) + Number(transaction.amount));
    });
    return Array.from(map.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [monthTx]);

  const evolucaoMensal = useMemo(() => {
    const map = new Map(lastNMonthKeys(12).map((mes) => [mes, { entradas: 0, despesas: 0 }]));
    scopedTx.forEach((transaction) => {
      const bucket = map.get(transaction.date.slice(0, 7));
      if (!bucket) return;
      if (isRenda(transaction)) bucket.entradas += Number(transaction.amount);
      else if (isGasto(transaction)) bucket.despesas += Number(transaction.amount);
    });
    return Array.from(map.entries()).map(([mes, values]) => ({ mes, ...values }));
  }, [scopedTx]);

  const evolucaoSaldo = useMemo(() => {
    const months = lastNMonthKeys(12);
    const cashNet = new Map(months.map((mes) => [mes, 0]));
    const patrNet = new Map(months.map((mes) => [mes, 0]));
    scopedTx.forEach((transaction) => {
      const key = transaction.date.slice(0, 7);
      if (!cashNet.has(key)) return;
      const amount = Number(transaction.amount);
      if (!isTransferDescription(transaction.description)) {
        cashNet.set(key, (cashNet.get(key) ?? 0) + (transaction.type === "entrada" ? amount : -amount));
      }
      if (isRenda(transaction)) patrNet.set(key, (patrNet.get(key) ?? 0) + amount);
      else if (isGasto(transaction)) patrNet.set(key, (patrNet.get(key) ?? 0) - amount);
    });
    const points: { mes: string; saldo: number; patrimonio: number }[] = [];
    let saldo = totalBalance;
    let patr = patrimonio;
    for (let index = months.length - 1; index >= 0; index -= 1) {
      const mes = months[index];
      points.push({ mes, saldo, patrimonio: patr });
      saldo -= cashNet.get(mes) ?? 0;
      patr -= patrNet.get(mes) ?? 0;
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

  const fluxoDiario = useMemo(() => {
    const days = lastNDateKeys(30);
    const byDay = new Map(days.map((key) => [key, { entradas: 0, despesas: 0 }]));
    scopedTx.forEach((transaction) => {
      const bucket = byDay.get(transaction.date);
      if (!bucket) return;
      if (isRenda(transaction)) bucket.entradas += Number(transaction.amount);
      else if (isGasto(transaction)) bucket.despesas += Number(transaction.amount);
    });
    return days.map((key) => {
      const bucket = byDay.get(key)!;
      const [, month, day] = key.split("-");
      return {
        dia: `${day}/${month}`,
        entradas: bucket.entradas,
        despesas: bucket.despesas,
      };
    });
  }, [scopedTx]);

  const gastosPorSemana = useMemo(() => {
    const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const totals = [0, 0, 0, 0, 0, 0, 0];
    monthTx.filter(isGasto).forEach((transaction) => {
      totals[parseISO(`${transaction.date}T12:00:00`).getDay()] += Number(transaction.amount);
    });
    return labels.map((dia, index) => ({ dia, total: totals[index] }));
  }, [monthTx]);

  const maioresGastos = useMemo(
    () =>
      monthTx
        .filter(isGasto)
        .sort((left, right) => Number(right.amount) - Number(left.amount))
        .slice(0, 8),
    [monthTx],
  );

  const mixPatrimonio = [
    { name: "Contas", value: Math.max(0, totalBalance), color: "#34d399" },
    { name: "Investido", value: Math.max(0, totalInvestments), color: "#60a5fa" },
    { name: "Faturas", value: Math.max(0, totalInvoices), color: "#f87171" },
  ];

  const investmentIds = useMemo(() => new Set(investments.map((item) => item.id)), [investments]);

  function toggleBank(id: string) {
    setOpenBanks((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <PageShell>
      <PageHero
        kicker="Visão geral"
        title={<HeroAmount>{formatCurrency(displayedBalance)}</HeroAmount>}
        trailing={
          <label className="rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-300">
            <select
              value={connectionId}
              onChange={(event) => setConnectionId(event.target.value)}
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
      </PageHero>

      <div className="flex flex-col gap-5 px-4 lg:gap-8 lg:px-6 xl:px-10 2xl:px-14">
      {connections.length === 0 && (
        <Link href="/bancos" className="rounded-full bg-white px-5 py-2.5 text-center text-sm font-medium text-zinc-950">
          Conectar banco
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Gastos de hoje", gastosHoje, "text-rose-300"],
          ["Gastos da semana", gastosSemana, "text-rose-300"],
          ["Entradas", monthEntradas, "text-emerald-400"],
          ["Despesas do mês", monthDespesas, "text-rose-300"],
        ].map(([label, value, tone]) => (
          <SoftPanel key={String(label)} className="px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
            <p className={`mt-1 truncate text-lg font-semibold ${tone}`}>{formatCurrency(Number(value))}</p>
          </SoftPanel>
        ))}
      </div>

      <SoftPanel className="px-4 py-4">
        <p className="text-[11px] uppercase tracking-wide text-zinc-500">Pode gastar por dia</p>
        <p className="mt-1 text-2xl font-semibold text-white">{formatCurrency(dailyBudget.perDay)}</p>
        <p className="mt-1 text-xs text-zinc-500">
          até {dailyUntilLabel} · {dailyBudget.days} {dailyBudget.days === 1 ? "dia" : "dias"} · saldo em conta
        </p>
      </SoftPanel>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 lg:rounded-3xl lg:p-6">
          <SectionLabel>Contas</SectionLabel>
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
                            <span>{friendlyAccountName(account.name, account.type)}</span>
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

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 lg:rounded-3xl lg:p-6">
          <SectionLabel>Cartões</SectionLabel>
          <p className="mt-2 text-3xl font-semibold text-red-400">{formatCurrency(totalInvoices)}</p>
          <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
            <span>{usedLimitPct.toFixed(0)}% utilizado</span>
            <span>Limite: {formatCurrency(totalLimit)}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-rose-400" style={{ width: `${Math.min(100, usedLimitPct)}%` }} />
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

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 lg:rounded-3xl lg:p-6">
          <div className="flex items-center justify-between gap-2">
            <SectionLabel>Investimentos</SectionLabel>
            <div className="flex rounded-full bg-zinc-900 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setInvestTab("classes")}
                className={`rounded-full px-2.5 py-1 ${investTab === "classes" ? "bg-white text-zinc-950" : "text-zinc-400"}`}
              >
                Classes
              </button>
              <button
                type="button"
                onClick={() => setInvestTab("instituicoes")}
                className={`rounded-full px-2.5 py-1 ${investTab === "instituicoes" ? "bg-white text-zinc-950" : "text-zinc-400"}`}
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
                    <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.max(8, item.share)}%` }} />
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
                      <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.max(8, item.share)}%` }} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 lg:rounded-3xl lg:p-6">
        <SectionLabel>Evolução do saldo</SectionLabel>
        <p className="mt-2 text-3xl font-semibold text-white">{formatCurrency(totalBalance)}</p>
        <p className="mt-1 text-xs text-zinc-500">Verde: saldo em contas · azul: patrimônio</p>
        <div className="mt-2">
          <SaldoEvolutionChart data={evolucaoSaldo} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 lg:col-span-2 lg:rounded-3xl lg:p-6">
          <h2 className="mb-2 text-sm font-medium text-zinc-300">Entradas x despesas (12 meses)</h2>
          <FluxoBarrasChart data={evolucaoMensal} />
        </section>
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 lg:rounded-3xl lg:p-6">
          <h2 className="mb-2 text-sm font-medium text-zinc-300">Gastos por categoria</h2>
          <GastosDonutChart data={gastosPorCategoria} />
        </section>
      </div>

      <LucroAtivosPanel
        connections={visibleConnections}
        investments={investments}
        snapshots={snapshots.filter((item) => investmentIds.has(item.investment_id))}
        investmentTx={investmentTx.filter((item) => !item.investment_id || investmentIds.has(item.investment_id))}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 lg:rounded-3xl lg:p-6">
          <h2 className="mb-2 text-sm font-medium text-zinc-300">Economia mensal</h2>
          <EconomiaMensalChart data={evolucaoMensal} />
        </section>
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 lg:rounded-3xl lg:p-6">
          <h2 className="mb-2 text-sm font-medium text-zinc-300">Entradas e saídas por dia (30 dias)</h2>
          <FluxoDiarioChart data={fluxoDiario} />
        </section>
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 lg:rounded-3xl lg:p-6">
          <h2 className="text-sm font-medium text-zinc-200">Gastos por dia da semana</h2>
          <p className="mb-2 mt-1 text-[11px] text-zinc-500">Quanto saiu em cada dia neste mês.</p>
          <SemanaGastosChart data={gastosPorSemana} />
        </section>
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 lg:rounded-3xl lg:p-6">
          <h2 className="text-sm font-medium text-zinc-200">Mix do patrimônio</h2>
          <p className="mb-2 mt-1 text-[11px] text-zinc-500">Quanto está em contas e quanto está investido.</p>
          <MixPizzaChart data={mixPatrimonio} />
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MaioresGastos items={maioresGastos} />
        <ProximasContas items={snapshot.proximos30Dias} saldoPrevisto={snapshot.saldoPrevisto30Dias} />
      </div>

      <GoalsProgress goals={snapshot.goals} />
      </div>
    </PageShell>
  );
}
