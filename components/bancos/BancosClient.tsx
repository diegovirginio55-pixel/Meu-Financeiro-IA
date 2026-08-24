"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { differenceInCalendarDays, isToday, isYesterday } from "date-fns";
import { formatCurrency } from "@/lib/finance/format";
import type { BankConnectionWithAssets } from "@/lib/finance/bank-connections";
import { officialInstitutionName } from "@/lib/pluggy/brands";
import { BankLogo } from "@/components/bancos/BankLogo";
import { realConnectionId } from "@/lib/finance/connection-filter";

const PluggyConnect = dynamic(
  () => import("react-pluggy-connect").then((mod) => mod.PluggyConnect),
  { ssr: false },
);

const ACTIVE_STATUSES = new Set(["UPDATED", "UPDATING"]);

function PlugIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path
        d="M9 7V3M15 7V3M8 11h8v3.5A5.5 5.5 0 0 1 10.5 20H10v3M12 20v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v4.2L15 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function formatLastSync(value: string | null): string {
  if (!value) return "Nunca atualizado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Nunca atualizado";
  if (isToday(date)) return "Hoje";
  if (isYesterday(date)) return "Ontem";
  const days = differenceInCalendarDays(new Date(), date);
  if (days < 7) return `Há ${days} dias`;
  return date.toLocaleDateString("pt-BR");
}

function ConnectionCard({
  connection,
  onOpen,
}: {
  connection: BankConnectionWithAssets;
  onOpen: () => void;
}) {
  const name = officialInstitutionName(connection.institution_name);
  const active = ACTIVE_STATUSES.has(connection.status);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[168px] flex-col rounded-2xl border border-zinc-800/90 bg-[#141414] p-4 text-left transition-colors hover:border-zinc-700"
    >
      <div className="flex items-start justify-between">
        <BankLogo name={name} imageUrl={connection.institution_image_url} />
        <span
          className={`mt-1 h-2.5 w-2.5 rounded-full ${
            active ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.85)]" : "bg-amber-400"
          }`}
        />
      </div>
      <p className="mt-6 text-[15px] font-semibold text-white">{name}</p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
        <ClockIcon />
        {formatLastSync(connection.last_synced_at)}
      </p>
      <span className="mt-auto w-full border-t border-zinc-800 pt-3 text-xs text-zinc-500">
        Ver detalhes &gt;
      </span>
    </button>
  );
}

function DetailsPanel({
  connection,
  syncing,
  onClose,
  onSync,
  onDisconnect,
}: {
  connection: BankConnectionWithAssets;
  syncing: boolean;
  onClose: () => void;
  onSync: () => void;
  onDisconnect: () => void;
}) {
  const name = officialInstitutionName(connection.institution_name);
  const hasAssets =
    connection.accounts.length > 0 ||
    connection.cards.length > 0 ||
    connection.investments.length > 0;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Fechar" />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-zinc-800 bg-[#141414] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <BankLogo name={name} imageUrl={connection.institution_image_url} />
            <div>
              <h3 className="text-base font-semibold text-white">{name}</h3>
              <p className="text-xs text-zinc-500">{formatLastSync(connection.last_synced_at)}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-zinc-500 hover:text-zinc-200">
            Fechar
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {hasAssets ? (
            <>
              {connection.accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-300">{account.name}</span>
                  <span className="font-medium text-white">{formatCurrency(Number(account.balance))}</span>
                </div>
              ))}
              {connection.cards.map((card) => (
                <div key={card.id} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-300">{card.name}</span>
                  <span className="font-medium text-red-400">
                    Fatura {formatCurrency(Number(card.current_invoice))}
                  </span>
                </div>
              ))}
              {connection.investments.map((investment) => (
                <div key={investment.id} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-300">
                    {investment.name}
                    {investment.type ? <span className="text-zinc-500"> · {investment.type}</span> : null}
                  </span>
                  <span className="font-medium text-emerald-400">
                    {formatCurrency(Number(investment.amount))}
                  </span>
                </div>
              ))}
            </>
          ) : (
            <p className="text-sm text-zinc-500">Nenhuma conta importada ainda. Sincronize para trazer os dados.</p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {syncing ? "Atualizando…" : "Atualizar agora"}
          </button>
          <button
            type="button"
            onClick={onDisconnect}
            disabled={syncing}
            className="rounded-full border border-red-900 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-950/40 disabled:opacity-50"
          >
            Desconectar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BancosClient({
  initialConnections,
}: {
  initialConnections: BankConnectionWithAssets[];
}) {
  const router = useRouter();
  const [connections, setConnections] = useState(initialConnections);
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setConnections(initialConnections);
  }, [initialConnections]);

  const existingItemId = connections[0]?.pluggy_item_id ?? null;
  const hasConnection = connections.length > 0;

  const selected = useMemo(
    () => connections.find((connection) => connection.id === selectedId) ?? null,
    [connections, selectedId],
  );
  const activeCount = connections.filter((connection) => ACTIVE_STATUSES.has(connection.status)).length;

  const refreshConnections = useCallback(async () => {
    const res = await fetch("/api/bank/connections");
    if (res.ok) {
      const data = await res.json();
      setConnections(data.connections ?? []);
    }
    router.refresh();
  }, [router]);

  const handleConnect = useCallback(async () => {
    setError(null);
    setLoadingToken(true);
    try {
      const res = await fetch("/api/bank/connect-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(existingItemId ? { itemId: existingItemId } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao iniciar conexão.");
      setConnectToken(data.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível iniciar a conexão com o banco. Tente novamente.");
    } finally {
      setLoadingToken(false);
    }
  }, [existingItemId]);

  async function handleSuccess(itemData: { item: unknown }) {
    setConnectToken(null);
    try {
      await fetch("/api/bank/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: itemData.item }),
      });
    } finally {
      await refreshConnections();
    }
  }

  async function handleSync(id: string) {
    const realId = realConnectionId(id);
    setSyncingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/bank/connections/${realId}`, { method: "POST" });
      if (!res.ok) throw new Error("Falha ao sincronizar.");
      await refreshConnections();
    } catch {
      setError("Não foi possível atualizar agora. Tente de novo em alguns minutos.");
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDisconnect(id: string) {
    if (
      !confirm(
        "Desconectar o Meu Pluggy? Nubank, Inter e os outros bancos dessa autorização saem juntos. As contas já importadas continuam salvas.",
      )
    ) {
      return;
    }
    const realId = realConnectionId(id);
    setSyncingId(id);
    try {
      await fetch(`/api/bank/connections/${realId}`, { method: "DELETE" });
      setSelectedId(null);
      await refreshConnections();
    } finally {
      setSyncingId(null);
    }
  }

  return (
    <div className="flex flex-col">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-white">Data Passport</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Os bancos ficam salvos. A atualização roda sozinha quando você abre o app.
        </p>
        <div className="mt-3 rounded-xl border border-zinc-800 bg-[#141414] px-4 py-3 text-sm text-zinc-400">
          <p className="font-medium text-zinc-200">Para conectar o Inter</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>
              Abra{" "}
              <a href="https://meu.pluggy.ai" target="_blank" rel="noreferrer" className="text-zinc-200 underline">
                meu.pluggy.ai
              </a>{" "}
              e conecte o Inter (o Nubank já pode estar lá).
            </li>
            <li>
              Volte aqui e clique em <span className="text-zinc-200">Atualizar bancos</span>. Não crie uma
              conexão nova — isso gera o erro que você viu.
            </li>
            <li>Autorize o Meu Pluggy de novo. O Inter aparece junto, sem apagar o Nubank.</li>
          </ol>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">{error}</p>
      )}

      <section className="mt-10">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-rose-500">
            <PlugIcon />
          </span>
          <h2 className="text-xs font-medium tracking-[0.18em] text-zinc-400">CONEXÕES</h2>
          {connections.length > 0 && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
              {activeCount} {activeCount === 1 ? "ativa" : "ativas"}
            </span>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {connections.map((connection) => (
            <ConnectionCard
              key={connection.id}
              connection={connection}
              onOpen={() => setSelectedId(connection.id)}
            />
          ))}

          <button
            type="button"
            onClick={() => void handleConnect()}
            disabled={loadingToken}
            className="flex min-h-[168px] flex-col items-start rounded-2xl border border-dashed border-zinc-800 bg-transparent p-4 text-left transition-colors hover:border-zinc-600 disabled:opacity-50"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 text-xl text-zinc-400">
              +
            </div>
            <p className="mt-6 text-[15px] font-semibold text-white">
              {loadingToken ? "Abrindo…" : hasConnection ? "Atualizar bancos" : "Conectar banco"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {hasConnection ? "Puxa o Inter e atualiza o Nubank" : "Via Meu Pluggy, sem custo"}
            </p>
            <span className="mt-auto border-t border-zinc-800 pt-3 text-xs text-zinc-500">
              {hasConnection ? "Atualizar >" : "Adicionar >"}
            </span>
          </button>
        </div>
      </section>

      <section className="mt-12">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-rose-500">
            <GridIcon />
          </span>
          <h2 className="text-xs font-medium tracking-[0.18em] text-zinc-400">APPS PARCEIROS</h2>
        </div>
        <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-zinc-800/80 bg-transparent">
          <p className="text-sm text-zinc-500">Nenhum app parceiro está acessando seus dados.</p>
        </div>
      </section>

      {selected && (
        <DetailsPanel
          connection={selected}
          syncing={syncingId === selected.id}
          onClose={() => setSelectedId(null)}
          onSync={() => handleSync(selected.id)}
          onDisconnect={() => handleDisconnect(selected.id)}
        />
      )}

      {connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          includeSandbox={false}
          connectorIds={[200]}
          selectedConnectorId={200}
          products={["ACCOUNTS", "CREDIT_CARDS", "TRANSACTIONS", "INVESTMENTS"]}
          language="pt"
          theme="dark"
          forceOauthInBrowser
          onSuccess={handleSuccess}
          onError={(error) => {
            const text = JSON.stringify(error ?? {});
            if (/ALREADY_EXISTS|already exists/i.test(text)) {
              setConnectToken(null);
              setError(
                "O Meu Pluggy já está conectado. Feche e use “Atualizar bancos” depois de conectar o Inter em meu.pluggy.ai.",
              );
            }
          }}
          onClose={() => setConnectToken(null)}
        />
      )}
    </div>
  );
}
