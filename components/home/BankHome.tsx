"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/finance/format";
import { friendlyAccountName } from "@/lib/finance/account-name";
import type { BankConnectionWithAssets } from "@/lib/finance/bank-connections";
import type { FinancialSnapshot } from "@/lib/finance/summary";
import { getBankBrand, officialInstitutionName } from "@/lib/pluggy/brands";
import { belongsToConnection, dailyBudgetFromBalance, greetingForNow, saoPauloTodayKey, saoPauloWeekStartKey, sumGastosInRange } from "@/lib/finance/fluxo";
import type { Transaction } from "@/lib/finance/types";
import { BalanceViewToggle, useBalanceView } from "@/components/ui/page-chrome";

function money(hidden: boolean, value: number) {
  if (hidden) return "••••••";
  return formatCurrency(value);
}

function shortBankName(name: string) {
  const official = officialInstitutionName(name);
  if (official === "Caixa Econômica Federal") return "Caixa";
  if (official === "Banco do Brasil") return "BB";
  return official;
}

export default function BankHome({
  snapshot,
  connections,
  historyTx = [],
}: {
  snapshot: FinancialSnapshot;
  connections: BankConnectionWithAssets[];
  historyTx?: Transaction[];
}) {
  const [connectionId, setConnectionId] = useState("all");
  const [hidden, setHidden] = useState(false);
  const [balanceView, setBalanceView] = useBalanceView();

  const selected = useMemo(
    () => connections.find((connection) => connection.id === connectionId) ?? null,
    [connectionId, connections],
  );

  const accounts = selected?.accounts ?? snapshot.accounts;
  const cards = selected?.cards ?? snapshot.cards;
  const investments = selected?.investments ?? snapshot.investments;
  const bankBalance = accounts.reduce((sum, item) => sum + Number(item.balance), 0);
  const bankInvestments = investments.reduce((sum, item) => sum + Number(item.amount), 0);
  const saldoConta = bankBalance;
  const saldoTotal = bankBalance + bankInvestments;
  const displayedBalance = balanceView === "total" ? saldoTotal : saldoConta;
  const monthName = format(new Date(), "LLLL", { locale: ptBR });
  const bankLabel = selected ? shortBankName(selected.institution_name) : "visão geral";
  const monthTotal = snapshot.monthEntradas + snapshot.monthDespesas;
  const inShare = monthTotal > 0 ? (snapshot.monthEntradas / monthTotal) * 100 : 50;
  const maxCategory = snapshot.gastosPorCategoria[0]?.total ?? 0;
  const todayKey = saoPauloTodayKey();
  const weekStart = saoPauloWeekStartKey();
  const scopedTx = useMemo(
    () => historyTx.filter((transaction) => belongsToConnection(transaction, connectionId, snapshot.accounts, snapshot.cards)),
    [historyTx, connectionId, snapshot.accounts, snapshot.cards],
  );
  const gastosHoje =
    historyTx.length > 0 ? sumGastosInRange(scopedTx, todayKey, todayKey) : snapshot.gastosHoje;
  const gastosSemana =
    historyTx.length > 0 ? sumGastosInRange(scopedTx, weekStart, todayKey) : snapshot.gastosSemana;
  const dailyBudget = dailyBudgetFromBalance(saldoConta, todayKey);
  const dailyUntilLabel = format(parseISO(`${dailyBudget.until}T12:00:00`), "d 'de' MMMM", { locale: ptBR });

  if (connections.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col justify-end pb-8 lg:justify-center lg:pb-0">
        <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-400">{greetingForNow()}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white lg:text-6xl">
          Seu dinheiro,
          <br />
          em um só lugar.
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-400 lg:text-base">
          Conecte Inter, Nubank ou Caixa para acompanhar patrimônio, gastos e investimentos.
        </p>
        <Link
          href="/bancos"
          className="mt-8 inline-flex w-fit rounded-full bg-white px-5 py-2.5 text-sm font-medium text-zinc-950"
        >
          Conectar banco
        </Link>
      </div>
    );
  }

  return (
    <div className="-mx-4 pb-6 text-zinc-100 lg:-mx-6">
      <section className="relative overflow-hidden px-4 pb-7 pt-1 lg:px-6 lg:pb-10">
        <div className="pointer-events-none absolute -right-16 -top-10 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl lg:h-[22rem] lg:w-[22rem]" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-16">
          <div>
            <header className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-emerald-400/90">
                {greetingForNow()}
              </p>
              <div className="flex items-center gap-1 lg:hidden">
                <button
                  type="button"
                  onClick={() => setHidden((value) => !value)}
                  aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400"
                >
                  {hidden ? <EyeOffIcon /> : <EyeIcon />}
                </button>
                <Link
                  href="/bancos"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400"
                  aria-label="Bancos conectados"
                >
                  <BanksIcon />
                </Link>
              </div>
            </header>

            <p className="mt-8 text-sm text-zinc-500 lg:mt-10">{bankLabel}</p>
            <p className="mt-1 text-[44px] font-semibold leading-none tracking-tight text-white lg:text-[64px]">
              {money(hidden, displayedBalance)}
            </p>
            <div className="mt-4">
              <BalanceViewToggle value={balanceView} onChange={setBalanceView} />
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              {balanceView === "total" ? "contas + investimentos" : "somente o livre nas contas"}
            </p>

            <div className="mt-6 flex items-center gap-3 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setConnectionId("all")}
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[11px] font-medium ${
                  connectionId === "all"
                    ? "bg-white text-zinc-950"
                    : "bg-zinc-900/80 text-zinc-400 ring-1 ring-zinc-800"
                }`}
              >
                Tudo
              </button>
              {connections.map((connection) => {
                const name = officialInstitutionName(connection.institution_name);
                const active = connection.id === connectionId;
                return (
                  <button
                    key={connection.id}
                    type="button"
                    onClick={() => setConnectionId(connection.id)}
                    aria-label={shortBankName(name)}
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-zinc-900/80 ${
                      active ? "ring-2 ring-emerald-400" : "ring-1 ring-zinc-800"
                    }`}
                  >
                    <BankLogo name={name} imageUrl={connection.institution_image_url} size="sm" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-7 lg:mt-0">
            <div className="mb-3 hidden items-center justify-end gap-2 lg:flex">
              <button
                type="button"
                onClick={() => setHidden((value) => !value)}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300"
              >
                {hidden ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                {hidden ? "Mostrar valores" : "Ocultar valores"}
              </button>
              <Link
                href="/bancos"
                className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300"
              >
                Bancos
              </Link>
            </div>
            {connectionId === "all" && (
              <div>
                <div className="mb-2 flex items-end justify-between text-xs">
                  <span className="text-emerald-300">{hidden ? "••••" : formatCurrency(snapshot.monthEntradas)}</span>
                  <span className="text-zinc-500">{monthName}</span>
                  <span className="text-rose-300">{hidden ? "••••" : formatCurrency(snapshot.monthDespesas)}</span>
                </div>
                <div className="flex h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div className="bg-emerald-400" style={{ width: `${inShare}%` }} />
                  <div className="bg-rose-400/80" style={{ width: `${100 - inShare}%` }} />
                </div>
                <p className="mt-2 text-center text-[11px] text-zinc-500">
                  {snapshot.economia >= 0 ? "sobrou" : "faltou"}{" "}
                  {hidden ? "••••" : formatCurrency(Math.abs(snapshot.economia))} em {monthName}
                </p>
              </div>
            )}
            <Link
              href="/chat"
              className="mt-5 flex items-center gap-3 rounded-full border border-zinc-800 bg-zinc-900/70 px-4 py-3"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-sm text-zinc-950">
                ✦
              </span>
              <span className="flex-1 text-sm text-zinc-400">O que você quer saber sobre seu dinheiro?</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 px-4 lg:px-6">
        <Link href="/fluxo" className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Gastos de hoje</p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-rose-300 lg:text-2xl">
            {money(hidden, gastosHoje)}
          </p>
        </Link>
        <Link href="/fluxo" className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Gastos da semana</p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-rose-300 lg:text-2xl">
            {money(hidden, gastosSemana)}
          </p>
        </Link>
      </section>

      <section className="mt-3 px-4 lg:px-6">
        <article className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Pode gastar por dia</p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-white lg:text-2xl">
            {money(hidden, dailyBudget.perDay)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            até {dailyUntilLabel} · {dailyBudget.days} {dailyBudget.days === 1 ? "dia" : "dias"} · saldo em conta
          </p>
        </article>
      </section>

      <section className="mt-2 lg:mt-4">
        <div className="mb-3 flex items-baseline justify-between px-4 lg:px-6">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">Carteira</h2>
          <Link href="/bancos" className="text-xs text-emerald-400">
            gerenciar
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto px-4 pb-1 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-6">
          {accounts.map((account) => {
            const connection =
              connections.find((item) => item.id === account.bank_connection_id) ?? selected;
            const name = officialInstitutionName(connection?.institution_name ?? account.name);
            const brand = getBankBrand(name);
            return (
              <article
                key={account.id}
                className="w-[210px] shrink-0 rounded-3xl p-4 lg:w-auto"
                style={{
                  background: brand
                    ? `linear-gradient(160deg, ${brand.bg} 0%, #09090b 78%)`
                    : "linear-gradient(160deg, #27272a 0%, #09090b 78%)",
                }}
              >
                <BankLogo name={name} imageUrl={connection?.institution_image_url} size="sm" />
                <p className="mt-6 truncate text-xs text-white/70">
                  {friendlyAccountName(account.name, account.type)}
                </p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-white">
                  {money(hidden, Number(account.balance))}
                </p>
              </article>
            );
          })}
          {bankInvestments > 0 && (
            <Link
              href="/ativos"
              className="w-[210px] shrink-0 rounded-3xl bg-gradient-to-br from-emerald-700 to-zinc-950 p-4 lg:w-auto"
            >
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-200/80">Investido</p>
              <p className="mt-6 text-xs text-white/70">{investments.length} ativos</p>
              <p className="mt-1 text-xl font-semibold tracking-tight text-white">
                {money(hidden, bankInvestments)}
              </p>
            </Link>
          )}
          {cards.map((card) => (
            <Link
              key={card.id}
              href="/detalhes"
              className="w-[210px] shrink-0 rounded-3xl bg-gradient-to-br from-zinc-800 to-zinc-950 p-4 ring-1 ring-zinc-800 lg:w-auto"
            >
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Fatura</p>
              <p className="mt-6 truncate text-xs text-white/70">{card.name}</p>
              <p className="mt-1 text-xl font-semibold tracking-tight text-rose-300">
                {money(hidden, Number(card.current_invoice))}
              </p>
            </Link>
          ))}
          {accounts.length === 0 && cards.length === 0 && bankInvestments === 0 && (
            <p className="text-sm text-zinc-500">Nada neste banco ainda.</p>
          )}
        </div>
      </section>

      <div className="mt-8 px-4 lg:mt-10 lg:grid lg:grid-cols-2 lg:gap-12 lg:px-6">
      {connectionId === "all" && snapshot.gastosPorCategoria.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
              Onde foi o dinheiro
            </h2>
            <Link href="/visao" className="text-xs text-emerald-400">
              gráficos
            </Link>
          </div>
          <div className="space-y-3">
            {snapshot.gastosPorCategoria.slice(0, 5).map((item) => (
              <div key={item.category}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-zinc-200">{item.category}</span>
                  <span className="text-zinc-400">{hidden ? "••••" : formatCurrency(item.total)}</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-emerald-400/80"
                    style={{ width: `${maxCategory > 0 ? (item.total / maxCategory) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {connectionId === "all" && snapshot.proximos30Dias.length > 0 && (
        <section className="mt-8 lg:mt-0">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
              Próximos 30 dias
            </h2>
            <Link href="/fluxo" className="text-xs text-emerald-400">
              fluxo
            </Link>
          </div>
          <div className="relative ml-2 border-l border-zinc-800 pl-4">
            {snapshot.proximos30Dias.slice(0, 4).map((item) => (
              <div key={`${item.date}-${item.description}`} className="relative mb-4 last:mb-0">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-emerald-400" />
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                  {format(parseISO(item.date), "d MMM", { locale: ptBR })}
                </p>
                <div className="mt-0.5 flex items-start justify-between gap-3">
                  <p className="text-sm text-zinc-100">{item.description}</p>
                  <p className={`shrink-0 text-sm ${item.type === "entrada" ? "text-emerald-400" : "text-rose-300"}`}>
                    {hidden
                      ? "••••"
                      : `${item.type === "entrada" ? "+" : "−"}${formatCurrency(item.amount)}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      </div>
    </div>
  );
}

function EyeIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function EyeOffIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M9.5 6.3A10.5 10.5 0 0 1 12 5c6 0 9.5 7 9.5 7a16 16 0 0 1-3.2 3.9M6.6 8.2A16 16 0 0 0 2.5 12s3.5 7 9.5 7c1.4 0 2.7-.3 3.8-.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BanksIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path d="M4 9.5 12 4l8 5.5V20H4V9.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 20v-6h8v6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
