"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/finance/format";
import type { BankConnectionWithAssets } from "@/lib/finance/bank-connections";

const PluggyConnect = dynamic(
  () => import("react-pluggy-connect").then((mod) => mod.PluggyConnect),
  { ssr: false },
);

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  UPDATED: { label: "Atualizado", tone: "text-emerald-400" },
  UPDATING: { label: "Atualizando…", tone: "text-amber-400" },
  LOGIN_ERROR: { label: "Erro de login — reconecte", tone: "text-red-400" },
  OUTDATED: { label: "Desatualizado", tone: "text-amber-400" },
  WAITING_USER_INPUT: { label: "Aguardando ação", tone: "text-amber-400" },
  WAITING_USER_ACTION: { label: "Aguardando ação", tone: "text-amber-400" },
};

function formatDateTime(value: string | null) {
  if (!value) return "nunca";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function ConnectionAssets({ connection }: { connection: BankConnectionWithAssets }) {
  const hasAssets =
    connection.accounts.length > 0 ||
    connection.cards.length > 0 ||
    connection.investments.length > 0;

  if (!hasAssets) {
    return (
      <p className="mt-3 border-t border-zinc-800 pt-3 text-xs text-zinc-500">
        Nenhuma conta importada ainda. Clique em Sincronizar agora para trazer saldo, cartões e
        investimentos.
      </p>
    );
  }

  return (
    <ul className="mt-3 flex flex-col gap-2 border-t border-zinc-800 pt-3">
      {connection.accounts.map((account) => (
        <li key={account.id} className="flex items-center justify-between text-sm">
          <span className="text-zinc-300">🏦 {account.name}</span>
          <span className="font-medium text-zinc-50">{formatCurrency(Number(account.balance))}</span>
        </li>
      ))}
      {connection.cards.map((card) => (
        <li key={card.id} className="flex items-center justify-between text-sm">
          <span className="text-zinc-300">💳 {card.name}</span>
          <span className="font-medium text-red-400">
            Fatura {formatCurrency(Number(card.current_invoice))}
          </span>
        </li>
      ))}
      {connection.investments.map((investment) => (
        <li key={investment.id} className="flex items-center justify-between text-sm">
          <span className="text-zinc-300">
            📈 {investment.name}
            {investment.type ? <span className="text-zinc-500"> · {investment.type}</span> : null}
          </span>
          <span className="font-medium text-emerald-400">
            {formatCurrency(Number(investment.amount))}
          </span>
        </li>
      ))}
    </ul>
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
  const [error, setError] = useState<string | null>(null);

  const autoStarted = useRef(false);

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
      const res = await fetch("/api/bank/connect-token", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao iniciar conexão.");
      setConnectToken(data.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível iniciar a conexão com o banco. Tente novamente.");
    } finally {
      setLoadingToken(false);
    }
  }, []);

  useEffect(() => {
    if (autoStarted.current || initialConnections.length > 0) return;
    autoStarted.current = true;
    void handleConnect();
  }, [handleConnect, initialConnections.length]);

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
    setSyncingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/bank/connections/${id}`, { method: "POST" });
      if (!res.ok) throw new Error("Falha ao sincronizar.");
      await refreshConnections();
    } catch {
      setError("Não foi possível sincronizar agora. Tente de novo em alguns minutos.");
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDisconnect(id: string) {
    if (!confirm("Desconectar este banco? As contas/transações já importadas continuam salvas.")) return;
    setSyncingId(id);
    try {
      await fetch(`/api/bank/connections/${id}`, { method: "DELETE" });
      await refreshConnections();
    } finally {
      setSyncingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div>
          <h2 className="text-sm font-medium text-zinc-50">Conectar Meu Pluggy</h2>
          <p className="text-sm text-zinc-400">
            Lê saldo e extrato das contas que você já autorizou em meu.pluggy.ai. Sem custo, só o seu CPF.
          </p>
        </div>
        <button
          onClick={() => void handleConnect()}
          disabled={loadingToken}
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
        >
          {loadingToken ? "Abrindo…" : "+ Conectar Meu Pluggy"}
        </button>
      </div>

      {error && (
        <p className="rounded-xl border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">{error}</p>
      )}

      {connections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
          Nenhum banco importado ainda. Conecte primeiro em meu.pluggy.ai e depois autorize aqui.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {connections.map((connection) => {
            const statusInfo = STATUS_LABELS[connection.status] ?? {
              label: connection.status,
              tone: "text-zinc-400",
            };
            const isBusy = syncingId === connection.id;
            return (
              <div key={connection.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {connection.institution_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={connection.institution_image_url}
                        alt=""
                        className="h-9 w-9 rounded-full bg-white object-contain p-1"
                      />
                    ) : (
                      <span className="text-2xl">🏦</span>
                    )}
                    <div>
                      <p className="text-sm font-medium text-zinc-50">{connection.institution_name}</p>
                      <p className={`text-xs ${statusInfo.tone}`}>{statusInfo.label}</p>
                      <p className="text-xs text-zinc-500">
                        Última sincronização: {formatDateTime(connection.last_synced_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSync(connection.id)}
                      disabled={isBusy}
                      className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {isBusy ? "…" : "Sincronizar agora"}
                    </button>
                    <button
                      onClick={() => handleDisconnect(connection.id)}
                      disabled={isBusy}
                      className="rounded-full border border-red-900 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-950/50 disabled:opacity-50"
                    >
                      Desconectar
                    </button>
                  </div>
                </div>
                <ConnectionAssets connection={connection} />
              </div>
            );
          })}
        </div>
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
          onError={() => setError("A conexão com o Meu Pluggy falhou ou foi cancelada.")}
          onClose={() => setConnectToken(null)}
        />
      )}
    </div>
  );
}
