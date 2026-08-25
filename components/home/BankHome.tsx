"use client";

import { useMemo } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency, formatPercent } from "@/lib/finance/format";
import { friendlyAccountName, isPlaceholderAccount } from "@/lib/finance/account-name";
import type { BankConnectionWithAssets } from "@/lib/finance/bank-connections";
import type { FinancialSnapshot } from "@/lib/finance/summary";
import { getBankBrand, officialInstitutionName } from "@/lib/pluggy/brands";
import { belongsToConnection, dailyBudgetFromBalance, greetingForNow, isGasto, isRenda, saoPauloMonthKey, saoPauloTodayKey, saoPauloWeekStartKey, sumGastosInRange } from "@/lib/finance/fluxo";
import { institutionFromAssetName, realConnectionId } from "@/lib/finance/connection-filter";
import type { Transaction } from "@/lib/finance/types";
import { CATEGORY_ICONS, categoryColor } from "@/lib/finance/categories";
import { BalanceViewToggle, useBalanceView } from "@/components/ui/page-chrome";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { BankLogo } from "@/components/bancos/BankLogo";
import { accumulatedProfit } from "@/lib/finance/investment-pnl";
import { useConnectionFilter, usePersistedState } from "@/lib/ui/use-persisted-state";

function money(hidden: boolean, value: number) {
  if (hidden) return "••••••";
  return formatCurrency(value);
}

function signedPercent(value: number) {
  const formatted = formatPercent(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

function ProfitArrow({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="currentColor" aria-hidden>
      {up ? (
        <path d="M8 3.2 13.2 9H10v4H6V9H2.8L8 3.2Z" />
      ) : (
        <path d="M8 12.8 2.8 7H6V3h4v4h3.2L8 12.8Z" />
      )}
    </svg>
  );
}

function shortBankName(name: string) {
  const official = officialInstitutionName(name);
  if (official === "Caixa Econômica Federal") return "Caixa";
  if (official === "Banco do Brasil") return "BB";
  return official;
}

function connectionForAsset(
  asset: { name: string; bank_connection_id?: string | null },
  connections: BankConnectionWithAssets[],
  selected: BankConnectionWithAssets | null,
) {
  const realId = asset.bank_connection_id;
  const bank = institutionFromAssetName(asset.name, "");
  return (
    connections.find(
      (connection) =>
        realConnectionId(connection.id) === realId &&
        (!bank || officialInstitutionName(connection.institution_name) === bank),
    ) ??
    connections.find((connection) => connection.id === realId) ??
    selected ??
    null
  );
}

const walletTileClass =
  "relative w-[268px] min-h-[176px] shrink-0 overflow-hidden rounded-[28px] p-5 ring-1 ring-white/10 lg:w-auto";

export default function BankHome({
  snapshot,
  connections,
  historyTx = [],
}: {
  snapshot: FinancialSnapshot;
  connections: BankConnectionWithAssets[];
  historyTx?: Transaction[];
}) {
  const connectionIds = useMemo(() => connections.map((connection) => connection.id), [connections]);
  const [connectionId, setConnectionId] = useConnectionFilter(connectionIds);
  const [hidden, setHidden] = usePersistedState("mf-hide-values", false);
  const [balanceView, setBalanceView] = useBalanceView();

  const selected = useMemo(
    () => connections.find((connection) => connection.id === connectionId) ?? null,
    [connectionId, connections],
  );

  const accounts = selected?.accounts ?? connections.flatMap((connection) => connection.accounts);
  const cards = selected?.cards ?? connections.flatMap((connection) => connection.cards);
  const investments = selected?.investments ?? connections.flatMap((connection) => connection.investments);
  const walletAccounts = [...accounts]
    .filter((account) => !isPlaceholderAccount(account))
    .sort((left, right) => Number(right.balance) - Number(left.balance));
  const walletCards = [...cards].sort(
    (left, right) => Number(right.current_invoice) - Number(left.current_invoice),
  );
  const bankBalance = accounts.reduce((sum, item) => sum + Number(item.balance), 0);
  const bankInvestments = investments.reduce((sum, item) => sum + Number(item.amount), 0);
  const investmentProfit = investments.reduce((sum, item) => sum + accumulatedProfit(item), 0);
  const investedCapital = investments.reduce((sum, item) => {
    const original = Number(item.amount_original ?? 0);
    if (original !== 0) return sum + original;
    const amount = Number(item.amount ?? 0);
    return sum + Math.max(0, amount - accumulatedProfit(item));
  }, 0);
  const investmentProfitPct = investedCapital > 0 ? (investmentProfit / investedCapital) * 100 : 0;
  const saldoConta = bankBalance;
  const saldoTotal = bankBalance + bankInvestments;
  const displayedBalance = balanceView === "total" ? saldoTotal : saldoConta;
  const monthKey = saoPauloMonthKey();
  const monthName = format(parseISO(`${monthKey}-01`), "LLLL", { locale: ptBR });
  const bankLabel = selected ? shortBankName(selected.institution_name) : "visão geral";
  const todayKey = saoPauloTodayKey();
  const weekStart = saoPauloWeekStartKey();
  const scopedTx = useMemo(
    () => historyTx.filter((transaction) => belongsToConnection(transaction, connectionId, snapshot.accounts, snapshot.cards)),
    [historyTx, connectionId, snapshot.accounts, snapshot.cards],
  );
  const monthTx = scopedTx.filter((transaction) => transaction.date.startsWith(monthKey));
  const monthEntradas = monthTx.filter(isRenda).reduce((sum, item) => sum + Number(item.amount), 0);
  const monthDespesas = monthTx.filter(isGasto).reduce((sum, item) => sum + Number(item.amount), 0);
  const monthTotal = monthEntradas + monthDespesas;
  const pctEntradas = monthTotal > 0 ? (monthEntradas / monthTotal) * 100 : 0;
  const pctSaidas = monthTotal > 0 ? (monthDespesas / monthTotal) * 100 : 0;
  const spendingCategories = snapshot.gastosPorCategoria;
  const spendingTotal = spendingCategories.reduce((sum, item) => sum + item.total, 0);
  const maxCategory = spendingCategories[0]?.total ?? 0;
  const gastosHoje =
    historyTx.length > 0 ? sumGastosInRange(scopedTx, todayKey, todayKey) : snapshot.gastosHoje;
  const gastosSemana =
    historyTx.length > 0 ? sumGastosInRange(scopedTx, weekStart, todayKey) : snapshot.gastosSemana;
  const dailyBudget = dailyBudgetFromBalance(saldoConta, todayKey);
  const dailyUntilLabel = format(parseISO(`${dailyBudget.until}T12:00:00`), "d 'de' MMMM", { locale: ptBR });

  if (connections.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col justify-end pb-8 lg:justify-center lg:pb-0">
        <img
          src="/logo.png"
          alt="Meu Financeiro IA"
          width={56}
          height={56}
          className="mb-6 h-14 w-14 rounded-2xl object-cover ring-1 ring-emerald-400/30 shadow-[0_0_28px_rgba(16,185,129,0.35)]"
        />
        <p className="text-sm font-medium tracking-wide text-emerald-400">{greetingForNow()}</p>
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
    <div className="-mx-4 pb-6 text-zinc-100 lg:-mx-6 xl:-mx-10 2xl:-mx-14">
      <section className="relative overflow-hidden px-4 pb-7 pt-1 lg:px-6 lg:pb-10 xl:px-10 2xl:px-14">
        <div className="pointer-events-none absolute -right-16 -top-10 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl lg:h-[22rem] lg:w-[22rem]" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-end lg:gap-16 xl:gap-24">
          <div>
            <header className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img
                  src="/logo.png"
                  alt=""
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-xl object-cover ring-1 ring-emerald-400/25 lg:hidden"
                />
                <p className="text-sm font-medium tracking-wide text-emerald-400/90">
                  {greetingForNow()}
                </p>
              </div>
              <div className="flex items-center gap-1 lg:hidden">
                <ThemeToggle />
                <button
                  type="button"
                  onClick={() => setHidden((value) => !value)}
                  aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-300"
                >
                  {hidden ? <EyeOffIcon /> : <EyeIcon />}
                </button>
                <Link
                  href="/bancos"
                  className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-300"
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
                <div className="mb-1.5 flex items-end justify-between text-xs">
                  <span className="text-emerald-300">
                    {hidden ? "••••" : formatCurrency(monthEntradas)}
                  </span>
                  <span className="text-zinc-500">{monthName}</span>
                  <span className="text-rose-300">
                    {hidden ? "••••" : formatCurrency(monthDespesas)}
                  </span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full shrink-0 bg-emerald-400" style={{ width: `${pctEntradas}%` }} />
                  <div className="h-full shrink-0 bg-rose-400" style={{ width: `${pctSaidas}%` }} />
                </div>
                <div className="mt-1.5 flex justify-between text-[11px]">
                  <span className="font-medium text-emerald-300">
                    {hidden ? "••••" : formatPercent(pctEntradas, 1)}
                  </span>
                  <span className="font-medium text-rose-300">
                    {hidden ? "••••" : formatPercent(pctSaidas, 1)}
                  </span>
                </div>
                <p className="mt-2 text-center text-[11px] text-zinc-500">
                  líquido da conta {money(hidden, saldoConta)}
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

      <section className="grid grid-cols-2 gap-3 px-4 lg:grid-cols-3 lg:px-6 xl:px-10 2xl:px-14">
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
        <article className="col-span-2 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4 lg:col-span-1">
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
        <div className="mb-3 flex items-baseline justify-between px-4 lg:px-6 xl:px-10 2xl:px-14">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">Carteira</h2>
          <Link href="/bancos" className="text-xs text-emerald-400">
            gerenciar
          </Link>
        </div>
        <div className="flex gap-4 overflow-x-auto px-4 pb-1 lg:grid lg:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] lg:overflow-visible lg:px-6 xl:px-10 2xl:px-14">
          {walletAccounts.map((account) => {
            const connection = connectionForAsset(account, connections, selected);
            const name = officialInstitutionName(connection?.institution_name ?? account.name);
            const brand = getBankBrand(name);
            return (
              <article
                key={account.id}
                className={walletTileClass}
                style={{
                  background: brand
                    ? `linear-gradient(155deg, ${brand.bg} 0%, ${brand.bg}99 28%, #09090b 72%)`
                    : "linear-gradient(155deg, #3f3f46 0%, #09090b 72%)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <BankLogo name={name} imageUrl={connection?.institution_image_url} size="lg" />
                  <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/55">
                    {shortBankName(name)}
                  </span>
                </div>
                <p className="mt-10 truncate text-sm text-white/75">
                  {friendlyAccountName(account.name, account.type)}
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-white">
                  {money(hidden, Number(account.balance))}
                </p>
              </article>
            );
          })}
          {bankInvestments > 0 && (
            <Link href="/ativos" className={`${walletTileClass} bg-gradient-to-br from-emerald-700 via-emerald-900 to-zinc-950`}>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-200/80">Investido</p>
              <p className="mt-8 text-sm text-white/75">
                {connectionId === "all"
                  ? connections
                      .filter((connection) => connection.investments.length > 0)
                      .map(
                        (connection) =>
                          `${connection.investments.length} no ${shortBankName(connection.institution_name)}`,
                      )
                      .join(" · ") || `${investments.length} ativos`
                  : `${investments.length} ${investments.length === 1 ? "ativo" : "ativos"}`}
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-white">
                {money(hidden, bankInvestments)}
              </p>
              <p
                className={`mt-2 flex items-center gap-1 text-xs font-medium ${
                  investmentProfit >= 0 ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                <ProfitArrow up={investmentProfit >= 0} />
                <span>{hidden ? "••••" : signedPercent(investmentProfitPct)}</span>
                <span className="text-white/45">·</span>
                <span>{hidden ? "••••" : money(false, investmentProfit)}</span>
              </p>
            </Link>
          )}
          {walletCards.map((card) => (
            <Link
              key={card.id}
              href="/detalhes"
              className={`${walletTileClass} bg-gradient-to-br from-zinc-700 via-zinc-900 to-zinc-950`}
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">Fatura</p>
              <p className="mt-10 truncate text-sm text-white/75">{card.name}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-rose-300">
                {money(hidden, Number(card.current_invoice))}
              </p>
            </Link>
          ))}
          {walletAccounts.length === 0 && walletCards.length === 0 && bankInvestments === 0 && (
            <p className="text-sm text-zinc-500">Nada neste banco ainda.</p>
          )}
        </div>
      </section>

      <div className="mt-8 px-4 lg:mt-10 lg:grid lg:grid-cols-2 lg:gap-12 lg:px-6 xl:gap-16 xl:px-10 2xl:px-14">
      {connectionId === "all" && spendingCategories.length > 0 && (
        <section className="rounded-[28px] border border-zinc-800 bg-zinc-900/70 p-4 lg:p-5">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                Onde foi o dinheiro
              </h2>
              <p className="mt-1 text-lg font-semibold text-white">
                {hidden ? "••••••" : formatCurrency(spendingTotal)}
              </p>
              <p className="text-xs text-zinc-500">gastos de {monthName}, sem PIX nem aplicações</p>
            </div>
            <Link href="/visao" className="text-xs text-emerald-400">
              gráficos
            </Link>
          </div>
          <div className="space-y-3.5">
            {spendingCategories.slice(0, 6).map((item) => {
              const share = spendingTotal > 0 ? (item.total / spendingTotal) * 100 : 0;
              const bar = maxCategory > 0 ? Math.max(6, (item.total / maxCategory) * 100) : 0;
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
                      <span className="block font-medium text-zinc-100">
                        {hidden ? "••••" : formatCurrency(item.total)}
                      </span>
                      <span className="text-[11px] text-zinc-500">{share.toFixed(0)}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${bar}%`,
                        backgroundColor: categoryColor(item.category),
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {connectionId === "all" && snapshot.proximos30Dias.length > 0 && (
        <section className="mt-8 rounded-[28px] border border-zinc-800 bg-zinc-900/70 p-4 lg:mt-0 lg:p-5">
          <div className="mb-4 flex items-baseline justify-between">
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

function EyeIcon({ className = "h-7 w-7" }: { className?: string }) {
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

function EyeOffIcon({ className = "h-7 w-7" }: { className?: string }) {
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
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden>
      <path d="M4 9.5 12 4l8 5.5V20H4V9.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 20v-6h8v6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
