"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/finance/format";
import type { BankConnectionWithAssets } from "@/lib/finance/bank-connections";
import type { FinancialSnapshot } from "@/lib/finance/summary";
import { getBankBrand, officialInstitutionName } from "@/lib/pluggy/brands";
import { BankLogo } from "@/components/bancos/BankLogo";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function shortBankName(name: string) {
  if (name === "Caixa Econômica Federal") return "Caixa";
  return name;
}

function bankTotal(connection: BankConnectionWithAssets) {
  const accounts = connection.accounts.reduce((sum, item) => sum + Number(item.balance), 0);
  const investments = connection.investments.reduce((sum, item) => sum + Number(item.amount), 0);
  return accounts + investments;
}

export default function BankHome({
  snapshot,
  connections,
}: {
  snapshot: FinancialSnapshot;
  connections: BankConnectionWithAssets[];
}) {
  const [hidden, setHidden] = useState(true);

  const money = (value: number) => (hidden ? "R$ •••••" : formatCurrency(value));
  const upcoming = snapshot.proximos30Dias.slice(0, 3);
  const recent = snapshot.maioresGastos.slice(0, 4);
  const economiaPositive = snapshot.economia >= 0;

  const banks = useMemo(
    () =>
      connections.map((connection) => {
        const name = officialInstitutionName(connection.institution_name);
        return {
          id: connection.id,
          name: shortBankName(name),
          imageUrl: connection.institution_image_url,
          color: getBankBrand(name)?.bg ?? "#27272a",
          total: bankTotal(connection),
          accounts: connection.accounts.length,
          investments: connection.investments.length,
        };
      }),
    [connections],
  );

  if (connections.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-center">
        <p className="text-lg font-semibold text-white">Nenhum banco conectado</p>
        <p className="mt-2 text-sm text-zinc-400">Conecte Inter, Nubank ou Caixa para ver o panorama aqui.</p>
        <Link href="/bancos" className="mt-5 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white">
          Conectar banco
        </Link>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 pb-8 text-zinc-100">
      <div className="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-24 h-56 w-56 rounded-full bg-violet-600/20 blur-3xl" />

      <header className="relative px-5 pt-[max(1.1rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-400/90">Meu Financeiro</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">{greeting()}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHidden((value) => !value)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5"
              aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
            >
              {hidden ? <EyeOffIcon /> : <EyeIcon />}
            </button>
            <Link
              href="/bancos"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5"
              aria-label="Bancos"
            >
              <BankIcon />
            </Link>
          </div>
        </div>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-950/40 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <p className="text-sm text-zinc-400">Patrimônio</p>
          <p className="mt-2 text-[34px] font-semibold leading-none tracking-tight text-white">{money(snapshot.patrimonio)}</p>
          <div className="mt-5 flex items-center justify-between gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                economiaPositive ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
              }`}
            >
              {economiaPositive ? "+" : ""}
              {money(snapshot.economia)} neste mês
            </span>
            <Link href="/visao" className="text-xs font-medium text-emerald-400">
              Ver gráficos →
            </Link>
          </div>
        </section>
      </header>

      <section className="relative mt-6 px-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Seus bancos</h2>
          <Link href="/bancos" className="text-xs text-zinc-400">
            Gerenciar
          </Link>
        </div>
        <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {banks.map((bank) => (
            <Link
              key={bank.id}
              href="/bancos"
              className="min-w-[168px] shrink-0 rounded-3xl border border-white/10 p-4"
              style={{ background: `linear-gradient(160deg, ${bank.color}cc, #18181b 78%)` }}
            >
              <BankLogo name={bank.name} imageUrl={bank.imageUrl} size="lg" />
              <p className="mt-4 text-sm font-semibold text-white">{bank.name}</p>
              <p className="mt-1 text-lg font-medium text-white">{money(bank.total)}</p>
              <p className="mt-1 text-[11px] text-white/60">
                {bank.accounts} contas · {bank.investments} ativos
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="relative mt-5 grid grid-cols-2 gap-3 px-5">
        <Link href="/ativos" className="rounded-3xl border border-white/10 bg-zinc-900/80 p-4">
          <p className="text-xs text-zinc-400">Investimentos</p>
          <p className="mt-2 text-lg font-semibold text-emerald-300">{money(snapshot.totalInvestments)}</p>
        </Link>
        <Link href="/fluxo" className="rounded-3xl border border-white/10 bg-zinc-900/80 p-4">
          <p className="text-xs text-zinc-400">Gastos do mês</p>
          <p className="mt-2 text-lg font-semibold text-rose-300">{money(snapshot.monthDespesas)}</p>
        </Link>
      </section>

      <section className="relative mt-6 px-5">
        <h2 className="mb-3 text-sm font-semibold text-white">Atalhos</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { href: "/chat", label: "Conversar com a IA", hint: "Lançar e perguntar" },
            { href: "/detalhes", label: "Extrato", hint: "Movimentações" },
            { href: "/fluxo", label: "Fluxo de caixa", hint: "Entradas e saídas" },
            { href: "/visao", label: "Visão geral", hint: "Gráficos do mês" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl border border-white/10 bg-zinc-900/70 px-4 py-3.5"
            >
              <p className="text-sm font-medium text-white">{item.label}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{item.hint}</p>
            </Link>
          ))}
        </div>
      </section>

      {upcoming.length > 0 && (
        <section className="relative mt-6 px-5">
          <h2 className="mb-3 text-sm font-semibold text-white">Próximos 30 dias</h2>
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/70">
            {upcoming.map((item, index) => (
              <div
                key={`${item.description}-${item.date}-${index}`}
                className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3 last:border-b-0"
              >
                <div>
                  <p className="text-sm text-zinc-100">{item.description}</p>
                  <p className="text-xs text-zinc-500">{formatDate(item.date)}</p>
                </div>
                <p className={`text-sm font-medium ${item.type === "entrada" ? "text-emerald-400" : "text-rose-400"}`}>
                  {item.type === "entrada" ? "+" : "−"}
                  {money(item.amount)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="relative mt-6 px-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Maiores gastos</h2>
            <Link href="/detalhes" className="text-xs text-zinc-400">
              Extrato
            </Link>
          </div>
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/70">
            {recent.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3 last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate text-sm text-zinc-100">{item.description}</p>
                  <p className="text-xs text-zinc-500">{item.category}</p>
                </div>
                <p className="shrink-0 text-sm font-medium text-rose-400">{money(Number(item.amount))}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path d="M3 3l18 18M10.5 10.7A3 3 0 0 0 13.3 13.5M9.9 5.5A11 11 0 0 1 12 5.2c5 0 9.3 3.5 10.8 8.3a11.7 11.7 0 0 1-4.2 5.5M6.1 6.5A11.6 11.6 0 0 0 1.2 13.5 11.6 11.6 0 0 0 12 18.8c1.3 0 2.5-.2 3.6-.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path d="M1.2 12.5C2.7 7.7 7 4.2 12 4.2s9.3 3.5 10.8 8.3C21.3 17.3 17 20.8 12 20.8S2.7 17.3 1.2 12.5Z" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function BankIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path d="M4 10h16M6 10v8M10 10v8M14 10v8M18 10v8M3 18h18M12 4 4 9h16L12 4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
