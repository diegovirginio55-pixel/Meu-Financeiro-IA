"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/finance/format";
import type { BankConnectionWithAssets } from "@/lib/finance/bank-connections";
import type { Investment, InvestmentSnapshot, InvestmentTxn } from "@/lib/finance/types";
import { officialInstitutionName } from "@/lib/pluggy/brands";
import { BankLogo } from "@/components/bancos/BankLogo";
import { buildDailyInvestmentPnl, totalAccumulatedProfit } from "@/lib/finance/investment-pnl";
import { LucroDiarioChart } from "@/components/ativos/LucroDiarioChart";

type AssetRow = Investment & {
  bankName: string;
  bankImage: string | null;
};

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path
        d="M4 6h16M7 12h10M10 18h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path
        d="M8 7V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1M4 9h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path d="M4 16 9.5 10.5 13 14l7-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 6h5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function groupLabel(type: string | null): string {
  const value = (type ?? "Outros").trim();
  if (!value) return "OUTROS";
  return value.toUpperCase();
}

function productKind(name: string, type: string | null): string {
  const haystack = `${name} ${type ?? ""}`.toUpperCase();
  if (haystack.includes("CDB")) return "CDB";
  if (haystack.includes("LCI")) return "LCI";
  if (haystack.includes("LCA")) return "LCA";
  if (haystack.includes("TESOURO")) return "Tesouro";
  if (haystack.includes("CRI")) return "CRI";
  if (haystack.includes("CRA")) return "CRA";
  return type || "Investimento";
}

function displayName(name: string, bankName: string): string {
  const escaped = bankName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const prefix = new RegExp(`^${escaped}\\s*[·•\\-]\\s*`, "i");
  return name.replace(prefix, "").trim() || name;
}

export default function AtivosClient({
  connections,
  snapshots = [],
  investmentTx = [],
}: {
  connections: BankConnectionWithAssets[];
  snapshots?: InvestmentSnapshot[];
  investmentTx?: InvestmentTxn[];
}) {
  const [connectionId, setConnectionId] = useState("all");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [chartMode, setChartMode] = useState<"juntos" | "separados" | "ambos">("ambos");

  const visibleConnections = useMemo(() => {
    if (connectionId === "all") return connections;
    return connections.filter((connection) => connection.id === connectionId);
  }, [connectionId, connections]);

  const assets = useMemo<AssetRow[]>(() => {
    return visibleConnections.flatMap((connection) => {
      const bankName = officialInstitutionName(connection.institution_name);
      return connection.investments.map((investment) => ({
        ...investment,
        bankName,
        bankImage: connection.institution_image_url,
      }));
    });
  }, [visibleConnections]);

  const total = assets.reduce((sum, asset) => sum + Number(asset.amount), 0);
  const lucroAcumulado = totalAccumulatedProfit(assets);

  const pnl = useMemo(() => {
    const investmentIds = new Set(assets.map((asset) => asset.id));
    return buildDailyInvestmentPnl({
      connections: visibleConnections,
      investments: assets,
      snapshots: snapshots.filter((item) => investmentIds.has(item.investment_id)),
      transactions: investmentTx.filter(
        (item) => !item.investment_id || investmentIds.has(item.investment_id),
      ),
    });
  }, [visibleConnections, assets, snapshots, investmentTx]);

  const lucroPeriodo = pnl.series.reduce((sum, point) => sum + Number(point.Total), 0);

  const groups = useMemo(() => {
    const map = new Map<string, AssetRow[]>();
    for (const asset of assets) {
      const key = groupLabel(asset.type);
      const list = map.get(key) ?? [];
      list.push(asset);
      map.set(key, list);
    }
    return Array.from(map.entries()).map(([label, items]) => ({
      label,
      items: items.sort((a, b) => Number(b.amount) - Number(a.amount)),
      total: items.reduce((sum, item) => sum + Number(item.amount), 0),
    }));
  }, [assets]);

  function toggle(id: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-white">Ativos</h1>
          <p className="mt-2 text-sm text-zinc-400">Seus investimentos e movimentações.</p>
        </div>

        <label className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-[#141414] px-3 py-2 text-sm text-zinc-200">
          <span className="text-zinc-500">
            <FilterIcon />
          </span>
          <select
            value={connectionId}
            onChange={(event) => setConnectionId(event.target.value)}
            className="bg-[#141414] text-sm text-zinc-100 outline-none [color-scheme:dark]"
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

      {connections.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-[#141414] p-6 text-sm text-zinc-500">
          Nenhum banco conectado ainda.{" "}
          <Link href="/bancos" className="text-zinc-200 underline">
            Conecte na aba Bancos
          </Link>{" "}
          para importar a carteira.
        </div>
      ) : (
        <>
        <section className="rounded-2xl border border-zinc-800 bg-[#141414] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-zinc-200">Lucro diário dos investimentos</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Total de todos os bancos e o rendimento de cada um nos últimos 30 dias.
                {pnl.estimated ? " Valores estimados pela taxa do último mês até haver histórico de sincronização." : ""}
              </p>
            </div>
            <div className="flex rounded-full bg-zinc-900 p-0.5 text-[11px]">
              {(
                [
                  ["juntos", "Juntos"],
                  ["separados", "Por banco"],
                  ["ambos", "Juntos e separados"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setChartMode(value)}
                  className={`rounded-full px-2.5 py-1 ${
                    chartMode === value ? "bg-emerald-600 text-white" : "text-zinc-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-zinc-800 px-3 py-2">
              <p className="text-xs text-zinc-500">Lucro acumulado</p>
              <p className={`mt-1 text-lg font-semibold ${lucroAcumulado >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {formatCurrency(lucroAcumulado)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 px-3 py-2">
              <p className="text-xs text-zinc-500">Lucro no gráfico (30 dias)</p>
              <p className={`mt-1 text-lg font-semibold ${lucroPeriodo >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {formatCurrency(lucroPeriodo)}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <LucroDiarioChart data={pnl.series} banks={pnl.banks} mode={chartMode} />
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-[#141414] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-zinc-200">
              <span className="text-rose-500">
                <BriefcaseIcon />
              </span>
              <span className="font-medium">
                Carteira ({assets.length} {assets.length === 1 ? "ativo" : "ativos"})
              </span>
            </div>
            <p className="text-lg font-semibold text-emerald-400">{formatCurrency(total)}</p>
          </div>

          {assets.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-500">
              Nenhum investimento nesta conexão. Na aba Bancos, sincronize o Inter. Se ainda vier vazio,
              no meu.pluggy.ai reconecte o Inter incluindo o consentimento de <strong>Investimentos</strong>.
            </p>
          ) : (
            <div className="mt-5 flex flex-col gap-5">
              {groups.map((group) => (
                <div key={group.label}>
                  <div className="mb-2 flex items-center justify-between text-xs tracking-[0.16em] text-zinc-500">
                    <span>{group.label}</span>
                    <span>{formatCurrency(group.total)}</span>
                  </div>
                  <ul className="flex flex-col">
                    {group.items.map((asset) => {
                      const open = openIds.has(asset.id);
                      const amount = Number(asset.amount);
                      const share = total > 0 ? (amount / total) * 100 : 0;
                      const kind = productKind(asset.name, asset.type);
                      return (
                        <li key={asset.id} className="border-t border-zinc-800/80">
                          <button
                            type="button"
                            onClick={() => toggle(asset.id)}
                            className="flex w-full items-center gap-3 py-3 text-left"
                          >
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300">
                              <TrendIcon />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-zinc-100">
                                {displayName(asset.name, asset.bankName)}
                              </span>
                              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                                <BankLogo name={asset.bankName} imageUrl={asset.bankImage} size="sm" />
                                {asset.bankName} · {kind}
                              </span>
                            </span>
                            <span className="text-right">
                              <span className="block text-sm font-medium text-emerald-400">
                                {formatCurrency(amount)}
                              </span>
                              {asset.amount_profit != null ? (
                                <span
                                  className={`text-xs ${
                                    Number(asset.amount_profit) >= 0 ? "text-emerald-500/80" : "text-red-400"
                                  }`}
                                >
                                  {Number(asset.amount_profit) >= 0 ? "+" : ""}
                                  {formatCurrency(Number(asset.amount_profit))}
                                </span>
                              ) : (
                                <span className="text-xs text-zinc-500">{share.toFixed(1)}%</span>
                              )}
                            </span>
                            <span className={`text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}>
                              ⌄
                            </span>
                          </button>
                          {open && (
                            <div className="pb-3 pl-11 text-xs text-zinc-500">
                              Tipo: {asset.type || "Investimento"} · Parte da carteira: {share.toFixed(1)}%
                              {asset.amount_profit != null && (
                                <>
                                  {" "}
                                  · Lucro acumulado:{" "}
                                  <span className={Number(asset.amount_profit) >= 0 ? "text-emerald-400" : "text-red-400"}>
                                    {formatCurrency(Number(asset.amount_profit))}
                                  </span>
                                </>
                              )}
                              {asset.last_month_rate != null && Number(asset.last_month_rate) !== 0 && (
                                <> · Taxa último mês: {Number(asset.last_month_rate).toFixed(2)}%</>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
        </>
      )}
    </div>
  );
}
