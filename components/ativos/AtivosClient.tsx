"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/finance/format";
import type { BankConnectionWithAssets } from "@/lib/finance/bank-connections";
import type { Investment, InvestmentSnapshot, InvestmentTxn } from "@/lib/finance/types";
import { officialInstitutionName } from "@/lib/pluggy/brands";
import { BankLogo } from "@/components/bancos/BankLogo";
import { LucroAtivosPanel } from "@/components/dashboard/LucroAtivosPanel";
import { HeroAmount, PageHero, PageShell, SectionLabel, SoftPanel } from "@/components/ui/page-chrome";

type AssetRow = Investment & {
  bankName: string;
  bankImage: string | null;
};

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
  if (haystack.includes("LCD")) return "LCD";
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
    <PageShell>
      <PageHero
        kicker="Investimentos"
        title={<HeroAmount>{formatCurrency(total)}</HeroAmount>}
        subtitle={`${assets.length} ${assets.length === 1 ? "ativo" : "ativos"} na carteira`}
        trailing={
          <label className="rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-300">
            <select
              value={connectionId}
              onChange={(event) => setConnectionId(event.target.value)}
              className="bg-transparent outline-none [color-scheme:dark]"
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
      />

      <div className="flex flex-col gap-6 px-4 lg:gap-8 lg:px-6 xl:px-10 2xl:px-14">
      {connections.length === 0 ? (
        <p className="text-sm text-zinc-400">
          Nenhum banco conectado ainda.{" "}
          <Link href="/bancos" className="text-emerald-400">
            Conecte na aba Bancos
          </Link>
          .
        </p>
      ) : (
        <>
        <LucroAtivosPanel
          connections={visibleConnections}
          investments={assets}
          snapshots={snapshots}
          investmentTx={investmentTx}
        />

        <section>
          <SectionLabel action={<span className="text-xs text-emerald-400">{formatCurrency(total)}</span>}>
            Carteira
          </SectionLabel>
          <SoftPanel className="p-4">

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
          </SoftPanel>
        </section>
        </>
      )}
      </div>
    </PageShell>
  );
}
