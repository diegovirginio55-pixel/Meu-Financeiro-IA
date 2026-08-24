"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { differenceInCalendarDays, isToday, isYesterday } from "date-fns";
import { formatCurrency } from "@/lib/finance/format";
import type { BankConnectionWithAssets } from "@/lib/finance/bank-connections";
import { getBankBrand, officialInstitutionName } from "@/lib/pluggy/brands";
import { PageHero, PageShell, SectionLabel } from "@/components/ui/page-chrome";
import { BankLogo } from "@/components/bancos/BankLogo";
import { realConnectionId } from "@/lib/finance/connection-filter";

const PluggyConnect = dynamic(
  () => import("react-pluggy-connect").then((mod) => mod.PluggyConnect),
  { ssr: false },
);

const ACTIVE_STATUSES = new Set(["UPDATED", "UPDATING"]);

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
  const brand = getBankBrand(name);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[168px] flex-col rounded-3xl p-4 text-left"
      style={{
        background: brand
          ? `linear-gradient(160deg, ${brand.bg} 0%, #09090b 78%)`
          : "linear-gradient(160deg, #27272a 0%, #09090b 78%)",
      }}
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
  const [addOpen, setAddOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [connectMode, setConnectMode] = useState<"create" | "update">("create");

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

  const handleConnect = useCallback(async (mode: "create" | "update" = "create") => {
    setError(null);
    setConnectMode(mode);
    setLoadingToken(true);
    try {
      const res = await fetch("/api/bank/connect-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "update" && existingItemId
            ? { itemId: existingItemId }
            : { addAnother: hasConnection },
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao iniciar conexão.");
      setConnectToken(data.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível iniciar a conexão com o banco. Tente novamente.");
    } finally {
      setLoadingToken(false);
    }
  }, [existingItemId, hasConnection]);

  async function handleBringBanks() {
    setError(null);
    setAddOpen(false);
    await handleConnect("create");
  }

  function handleAddClick() {
    setError(null);
    void handleConnect("create");
  }

  async function handleSuccess(itemData: { item: unknown }) {
    setConnectToken(null);
    setAddOpen(false);
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
        "Desconectar este banco? As contas já importadas continuam salvas.",
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
    <PageShell>
      <PageHero
        kicker="Bancos"
        title={`${connections.length} ${connections.length === 1 ? "conexão" : "conexões"}`}
        subtitle="Inter, Caixa e Nubank — uma autorização cada um neste app"
        trailing={
          hasConnection ? (
            <button
              type="button"
              onClick={() => void handleBringBanks()}
              disabled={importing || loadingToken}
              className="rounded-full bg-white px-3 py-2 text-xs font-medium text-zinc-950 disabled:opacity-50"
            >
              {importing || loadingToken ? "Abrindo…" : "Autorizar"}
            </button>
          ) : null
        }
      >
        <p className="text-sm leading-relaxed text-zinc-400">
          Na janela do Meu Pluggy, toque em Continuar e autorize o banco. O Nubank já fica salvo.
        </p>
      </PageHero>

      <div className="px-4 lg:px-6">
      {error && (
        <p className="mb-4 rounded-2xl border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">{error}</p>
      )}

      <section>
        <SectionLabel
          action={
            connections.length > 0 ? (
              <span className="text-xs text-emerald-400">
                {activeCount} {activeCount === 1 ? "ativa" : "ativas"}
              </span>
            ) : null
          }
        >
          Conexões
        </SectionLabel>

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
            onClick={handleAddClick}
            disabled={loadingToken || importing}
            className="flex min-h-[168px] flex-col items-start rounded-2xl border border-dashed border-zinc-800 bg-transparent p-4 text-left transition-colors hover:border-zinc-600 disabled:opacity-50"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 text-xl text-zinc-400">
              +
            </div>
            <p className="mt-6 text-[15px] font-semibold text-white">
              {loadingToken || importing ? "Abrindo…" : "Adicionar banco"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {hasConnection ? "Inter, Caixa e outros pelo Meu Pluggy" : "Via Meu Pluggy, sem custo"}
            </p>
            <span className="mt-auto border-t border-zinc-800 pt-3 text-xs text-zinc-500">
              Adicionar &gt;
            </span>
          </button>
        </div>
      </section>

      <section className="mt-10">
        <SectionLabel>Apps parceiros</SectionLabel>
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

      {addOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={() => setAddOpen(false)}
            aria-label="Fechar"
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-zinc-800 bg-[#141414] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">Adicionar outro banco</h3>
                <p className="mt-1 text-sm text-zinc-400">
                  O Nubank já está salvo. Bancos novos entram pelo Meu Pluggy, não por uma conexão nova aqui.
                </p>
              </div>
              <button type="button" onClick={() => setAddOpen(false)} className="text-sm text-zinc-500 hover:text-zinc-200">
                Fechar
              </button>
            </div>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-zinc-400">
              <li>Abra o Meu Pluggy e conecte o Inter (ou outro banco).</li>
              <li>Volte aqui e traga os bancos para o app. O Nubank continua.</li>
            </ol>
            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href="https://meu.pluggy.ai"
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200"
              >
                Abrir Meu Pluggy
              </a>
              <button
                type="button"
                onClick={() => void handleBringBanks()}
                disabled={importing || loadingToken}
                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {importing ? "Trazendo…" : "Já conectei — trazer para o app"}
              </button>
              <button
                type="button"
                onClick={() => void handleConnect("update")}
                disabled={loadingToken || importing}
                className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
              >
                Reautorizar
              </button>
            </div>
          </div>
        </div>
      )}

      {connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          includeSandbox={false}
          {...(connectMode === "update" && existingItemId
            ? { updateItem: existingItemId }
            : { connectorIds: [200], selectedConnectorId: 200, forceOauthInBrowser: true })}
          products={["ACCOUNTS", "CREDIT_CARDS", "TRANSACTIONS", "INVESTMENTS"]}
          language="pt"
          theme="dark"
          onSuccess={handleSuccess}
          onClose={() => setConnectToken(null)}
        />
      )}
      </div>
    </PageShell>
  );
}
