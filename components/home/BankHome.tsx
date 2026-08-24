"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/finance/format";
import type { BankConnectionWithAssets } from "@/lib/finance/bank-connections";
import type { FinancialSnapshot } from "@/lib/finance/summary";
import { officialInstitutionName } from "@/lib/pluggy/brands";
import { BankLogo } from "@/components/bancos/BankLogo";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function money(hidden: boolean, value: number) {
  if (hidden) return "R$ •••••";
  return formatCurrency(value);
}

export default function BankHome({
  snapshot,
  connections,
}: {
  snapshot: FinancialSnapshot;
  connections: BankConnectionWithAssets[];
}) {
  const [connectionId, setConnectionId] = useState("all");
  const [hidden, setHidden] = useState(true);

  const selected = useMemo(
    () => connections.find((connection) => connection.id === connectionId) ?? null,
    [connectionId, connections],
  );

  const accounts = selected?.accounts ?? snapshot.accounts;
  const cards = selected?.cards ?? snapshot.cards;
  const investments = selected?.investments ?? snapshot.investments;
  const bankBalance = accounts.reduce((sum, item) => sum + Number(item.balance), 0);
  const bankInvestments = investments.reduce((sum, item) => sum + Number(item.amount), 0);
  const bankInvoices = cards.reduce((sum, item) => sum + Number(item.current_invoice), 0);
  const patrimonio = selected
    ? bankBalance + bankInvestments - bankInvoices
    : snapshot.patrimonio;
  const economia = snapshot.economia;
  const bankLabel = selected
    ? officialInstitutionName(selected.institution_name)
    : "Todos os bancos";

  if (connections.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-semibold text-white">Nenhum banco conectado</p>
        <p className="mt-2 text-sm text-zinc-400">Conecte Inter, Nubank ou Caixa para ver o patrimônio aqui.</p>
        <Link href="/bancos" className="mt-5 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white">
          Conectar banco
        </Link>
      </div>
    );
  }

  return (
    <div className="relative pb-4 text-zinc-100">
      <div className="pointer-events-none absolute -top-24 right-0 h-56 w-56 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="pointer-events-none absolute top-40 -left-16 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl" />

      <header className="relative flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-400">{greeting()}</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-white">Meu Financeiro</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHidden((value) => !value)}
            className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300"
          >
            {hidden ? "Mostrar" : "Ocultar"}
          </button>
          <Link href="/bancos" className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300">
            Bancos
          </Link>
        </div>
      </header>

      <div className="relative mt-5 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setConnectionId("all")}
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
            connectionId === "all"
              ? "bg-white text-zinc-950"
              : "border border-zinc-800 bg-zinc-900 text-zinc-300"
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
              className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm ${
                active ? "bg-white text-zinc-950" : "border border-zinc-800 bg-zinc-900 text-zinc-300"
              }`}
            >
              <BankLogo name={name} imageUrl={connection.institution_image_url} size="sm" />
              {name === "Caixa Econômica Federal" ? "Caixa" : name}
            </button>
          );
        })}
      </div>

      <section className="relative mt-5 overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-emerald-950/40 p-5">
        <p className="text-sm text-zinc-400">Patrimônio · {bankLabel}</p>
        <p className="mt-2 text-[34px] font-semibold leading-none tracking-tight text-white">
          {money(hidden, patrimonio)}
        </p>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <MiniStat label="Contas" value={money(hidden, bankBalance)} />
          <MiniStat label="Investido" value={money(hidden, bankInvestments)} />
          <MiniStat
            label="Mês"
            value={hidden ? "••••" : formatCurrency(economia)}
            tone={economia >= 0 ? "good" : "bad"}
          />
        </div>
      </section>

      <Link
        href="/chat"
        className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-800/60 bg-emerald-950/40 px-4 py-3"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-lg">✦</span>
        <span className="flex-1">
          <span className="block text-sm font-medium text-white">Conversar com a IA</span>
          <span className="text-xs text-emerald-200/80">Pergunte sobre gastos, saldo e investimentos</span>
        </span>
        <span className="text-emerald-300">›</span>
      </Link>

      <section className="mt-5 grid grid-cols-2 gap-3">
        <ActionCard href="/detalhes" title="Extrato" subtitle="Lançamentos" />
        <ActionCard href="/fluxo" title="Fluxo" subtitle="Entradas e saídas" />
        <ActionCard href="/ativos" title="Investimentos" subtitle={`${investments.length} ativos`} />
        <ActionCard href="/visao" title="Gráficos" subtitle="Visão do mês" />
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-300">Contas</h2>
          <Link href="/bancos" className="text-xs text-emerald-400">
            Gerenciar
          </Link>
        </div>
        <div className="flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70">
          {accounts.length === 0 ? (
            <p className="px-4 py-5 text-sm text-zinc-500">Nenhuma conta neste banco.</p>
          ) : (
            accounts.map((account, index) => (
              <div
                key={account.id}
                className={`flex items-center justify-between px-4 py-3 ${
                  index > 0 ? "border-t border-zinc-800" : ""
                }`}
              >
                <span className="min-w-0 pr-3">
                  <span className="block truncate text-sm text-zinc-100">{account.name}</span>
                  <span className="text-xs text-zinc-500">{account.type || "Conta"}</span>
                </span>
                <span className="shrink-0 text-sm font-medium text-emerald-400">
                  {money(hidden, Number(account.balance))}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {snapshot.maioresGastos.length > 0 && connectionId === "all" && (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-300">Maiores gastos</h2>
            <Link href="/detalhes" className="text-xs text-emerald-400">
              Ver extrato
            </Link>
          </div>
          <div className="flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70">
            {snapshot.maioresGastos.slice(0, 4).map((item, index) => (
              <div
                key={item.id}
                className={`flex items-center justify-between px-4 py-3 ${index > 0 ? "border-t border-zinc-800" : ""}`}
              >
                <span className="min-w-0 pr-3">
                  <span className="block truncate text-sm text-zinc-100">{item.description}</span>
                  <span className="text-xs text-zinc-500">{item.category}</span>
                </span>
                <span className="shrink-0 text-sm text-red-400">
                  {hidden ? "••••" : formatCurrency(Number(item.amount))}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  const color =
    tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-red-400" : "text-white";
  return (
    <div className="rounded-2xl bg-black/25 px-2 py-2.5">
      <p className="text-[11px] text-zinc-400">{label}</p>
      <p className={`mt-1 truncate text-[13px] font-medium ${color}`}>{value}</p>
    </div>
  );
}

function ActionCard({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
      <p className="text-[15px] font-medium text-white">{title}</p>
      <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
    </Link>
  );
}
