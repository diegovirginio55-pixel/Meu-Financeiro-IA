"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/finance/format";
import { friendlyAccountName } from "@/lib/finance/account-name";
import type { BankConnectionWithAssets } from "@/lib/finance/bank-connections";
import { getBankBrand, officialInstitutionName } from "@/lib/pluggy/brands";
import { PageHero, PageShell, SectionLabel } from "@/components/ui/page-chrome";
import { BankLogo } from "@/components/bancos/BankLogo";
import { realConnectionId } from "@/lib/finance/connection-filter";
import { formatRelativeDaySP } from "@/lib/ui/datetime";
import { connectionFreshness } from "@/lib/finance/connection-freshness";
import { useDialog } from "@/lib/ui/use-dialog";

const PluggyConnect = dynamic(
  () => import("react-pluggy-connect").then((mod) => mod.PluggyConnect),
  { ssr: false },
);

// O gráfico (Recharts) só aparece dentro do modal de detalhes: carrega sob demanda.
const BalanceHistoryChart = dynamic(
  () => import("@/components/bancos/BalanceHistoryChart").then((mod) => mod.BalanceHistoryChart),
  {
    ssr: false,
    loading: () => <p className="mt-4 h-4 text-xs text-zinc-500">Carregando histórico de saldo…</p>,
  },
);

const ACTIVE_STATUSES = new Set(["UPDATED", "UPDATING"]);

/** "próxima atualização hoje às 17:33" (ou "em instantes" se a Pluggy já devia ter atualizado). */
function formatNextUpdate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getTime() <= Date.now()) return "próxima atualização em instantes";
  return `próxima atualização ${formatRelativeDaySP(date)}`;
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
          ? `linear-gradient(160deg, ${brand.bg} 0%, var(--background) 78%)`
          : "linear-gradient(160deg, var(--color-zinc-800, #27272a) 0%, var(--background) 78%)",
      }}
    >
      <div className="flex items-start justify-between">
        <BankLogo name={name} imageUrl={connection.institution_image_url} size="lg" />
        <span
          className={`mt-1 h-2.5 w-2.5 rounded-full ${
            active ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.85)]" : "bg-amber-400"
          }`}
        />
      </div>
      <p className="mt-6 text-[15px] font-semibold text-white">{name}</p>
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
  onReauthorize,
}: {
  connection: BankConnectionWithAssets;
  syncing: boolean;
  onClose: () => void;
  onSync: () => void;
  onDisconnect: () => void;
  onReauthorize: () => void;
}) {
  const needsReauth = !ACTIVE_STATUSES.has(connection.status);
  const freshness = connectionFreshness(connection);
  const nextUpdate = formatNextUpdate(freshness.nextAutoSyncAt);
  const name = officialInstitutionName(connection.institution_name);
  const hasAssets =
    connection.accounts.length > 0 ||
    connection.cards.length > 0 ||
    connection.investments.length > 0;
  const dialogRef = useDialog<HTMLDivElement>(onClose);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <button
        type="button"
        tabIndex={-1}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Fechar"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bank-details-title"
        tabIndex={-1}
        className="relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-800 bg-[#141414] p-5 shadow-2xl outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <BankLogo name={name} imageUrl={connection.institution_image_url} />
            <div>
              <h3 id="bank-details-title" className="text-base font-semibold text-white">
                {name}
              </h3>
              {nextUpdate && (
                <p className="text-xs text-zinc-500">
                  {nextUpdate.charAt(0).toUpperCase() + nextUpdate.slice(1)}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-autofocus
            className="text-sm text-zinc-400 hover:text-zinc-200"
          >
            Fechar
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {hasAssets ? (
            <>
              {connection.accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-300">{friendlyAccountName(account.name, account.type)}</span>
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

        <BalanceHistoryChart key={connection.id} connectionId={connection.id} />

        <p className="mt-4 text-xs leading-relaxed text-zinc-500">
          O Meu Pluggy busca os dados de cada banco 1 vez a cada 24 horas e não permite forçar antes disso. O app
          confere a Pluggy a cada poucos minutos: assim que ela trouxer dados novos, eles aparecem aqui e as
          movimentações chegam por notificação.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {syncing ? "Atualizando…" : "Atualizar agora"}
          </button>
          {needsReauth && (
            <button
              type="button"
              onClick={onReauthorize}
              disabled={syncing}
              className="rounded-full border border-amber-700 px-4 py-2 text-sm font-medium text-amber-200 hover:bg-amber-950/40 disabled:opacity-50"
            >
              Reautorizar este banco
            </button>
          )}
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

/** Meu Pluggy (uso pessoal) permite poucas conexões; acima disso o banco novo não aparece. */
const MEU_PLUGGY_LIMIT = 5;

function AddBankDialog({
  busy,
  connectedNames,
  onClose,
  onBringBanks,
}: {
  busy: boolean;
  connectedNames: string[];
  onClose: () => void;
  onBringBanks: () => void;
}) {
  const dialogRef = useDialog<HTMLDivElement>(onClose);
  const remaining = Math.max(0, MEU_PLUGGY_LIMIT - connectedNames.length);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <button
        type="button"
        tabIndex={-1}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Fechar"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-bank-title"
        tabIndex={-1}
        className="relative z-10 w-full max-w-lg rounded-2xl border border-zinc-800 bg-[#141414] p-5 shadow-2xl outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="add-bank-title" className="text-base font-semibold text-white">
              Adicionar banco
            </h3>
            <p className="mt-1 text-sm text-zinc-400">
              Bradesco, Santander, Itaú, BB e outros entram pelo Meu Pluggy (grátis, via Open Finance). São dois
              passos: conectar lá e depois autorizar aqui.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-autofocus
            className="text-sm text-zinc-400 hover:text-zinc-200"
          >
            Fechar
          </button>
        </div>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-zinc-300">
          <li>
            Abra o <strong>Meu Pluggy</strong>, entre com a sua conta e conecte um banco novo. Escolha o banco
            (ex.: Bradesco) e confirme no app do próprio banco.
          </li>
          <li>Espere o banco aparecer como conectado no Meu Pluggy (pode levar alguns minutos).</li>
          <li>
            Volte aqui e toque em <strong>Já conectei — trazer para o app</strong>. Na janela que abrir, entre no Meu
            Pluggy e autorize o banco novo. Cada banco é uma autorização.
          </li>
        </ol>
        {connectedNames.length > 0 && (
          <p className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs leading-relaxed text-zinc-400">
            Já no app: {connectedNames.join(", ")}.{" "}
            {remaining > 0
              ? `O Meu Pluggy pessoal aceita até ${MEU_PLUGGY_LIMIT} bancos — dá para adicionar mais ${remaining}.`
              : `O Meu Pluggy pessoal aceita até ${MEU_PLUGGY_LIMIT} bancos; para incluir outro, remova um lá no Meu Pluggy.`}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <a
            href="https://meu.pluggy.ai"
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200"
          >
            1. Abrir Meu Pluggy
          </a>
          <button
            type="button"
            onClick={onBringBanks}
            disabled={busy}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? "Abrindo…" : "2. Já conectei — trazer para o app"}
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
  // Lista atualizada localmente (após sincronizar) vale só enquanto o servidor não manda uma nova:
  // quando `initialConnections` muda (router.refresh), volta a usar a do servidor — derivado, sem efeito.
  const [localConnections, setLocalConnections] = useState<{
    base: BankConnectionWithAssets[];
    list: BankConnectionWithAssets[];
  } | null>(null);
  const connections =
    localConnections && localConnections.base === initialConnections ? localConnections.list : initialConnections;
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Modo do widget: criar um item novo (banco novo) ou reautorizar um item específico.
  const [connectTarget, setConnectTarget] = useState<{ mode: "create" } | { mode: "update"; itemId: string }>({
    mode: "create",
  });

  const hasConnection = connections.length > 0;
  const connectedNames = useMemo(
    () => Array.from(new Set(connections.map((connection) => officialInstitutionName(connection.institution_name)))),
    [connections],
  );

  const selected = useMemo(
    () => connections.find((connection) => connection.id === selectedId) ?? null,
    [connections, selectedId],
  );
  const activeCount = connections.filter((connection) => ACTIVE_STATUSES.has(connection.status)).length;

  const refreshConnections = useCallback(async () => {
    const res = await fetch("/api/bank/connections");
    if (res.ok) {
      const data = await res.json();
      setLocalConnections({ base: initialConnections, list: data.connections ?? [] });
    }
    router.refresh();
  }, [router, initialConnections]);

  const handleConnect = useCallback(
    async (target: { mode: "create" } | { mode: "update"; itemId: string } = { mode: "create" }) => {
      setError(null);
      setNotice(null);
      setConnectTarget(target);
      setLoadingToken(true);
      try {
        const res = await fetch("/api/bank/connect-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(target.mode === "update" ? { itemId: target.itemId } : { addAnother: hasConnection }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Falha ao iniciar conexão.");
        setConnectToken(data.accessToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível iniciar a conexão com o banco. Tente novamente.");
      } finally {
        setLoadingToken(false);
      }
    },
    [hasConnection],
  );

  async function handleBringBanks() {
    setAddOpen(false);
    await handleConnect({ mode: "create" });
  }

  // "Adicionar banco" abre primeiro o passo a passo: o banco precisa estar
  // conectado no Meu Pluggy antes — sem isso a janela não tem o que autorizar.
  function handleAddClick() {
    setError(null);
    setNotice(null);
    setAddOpen(true);
  }

  async function handleSuccess(itemData: { item: unknown }) {
    setConnectToken(null);
    setAddOpen(false);
    const itemId = (itemData.item as { id?: string } | null)?.id;
    const alreadyConnected = Boolean(itemId && connections.some((connection) => connection.pluggy_item_id === itemId));
    try {
      const res = await fetch("/api/bank/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: itemData.item }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "O banco foi autorizado, mas não deu para salvar a conexão. Tente de novo.");
      } else if (connectTarget.mode === "update") {
        setNotice("Banco reautorizado. Os dados serão atualizados em instantes.");
      } else if (alreadyConnected) {
        setNotice(
          "Esse banco já estava no app. Para trazer um banco novo, conecte-o primeiro no Meu Pluggy e depois autorize aqui.",
        );
      } else {
        setNotice("Banco adicionado! As contas, o extrato e os investimentos estão sendo importados.");
      }
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
    setError(null);
    try {
      const res = await fetch(`/api/bank/connections/${realId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "Não foi possível desconectar agora. Tente de novo.");
        return;
      }
      setSelectedId(null);
      await refreshConnections();
    } catch {
      setError("Não foi possível desconectar agora. Verifique sua conexão.");
    } finally {
      setSyncingId(null);
    }
  }


  return (
    <PageShell>
      <PageHero
        kicker="Bancos"
        title={`${connections.length} ${connections.length === 1 ? "conexão" : "conexões"}`}
        subtitle={
          hasConnection ? `${connectedNames.join(", ")} — uma autorização para cada banco` : "Conecte seus bancos pelo Meu Pluggy"
        }
        trailing={
          <button
            type="button"
            onClick={handleAddClick}
            disabled={loadingToken}
            className="rounded-full bg-white px-3 py-2 text-xs font-medium text-zinc-950 disabled:opacity-50"
          >
            {loadingToken ? "Abrindo…" : "+ Banco"}
          </button>
        }
      >
        <p className="text-sm leading-relaxed text-zinc-400">
          Para trazer outro banco (Bradesco, Santander...), conecte-o primeiro no Meu Pluggy e depois autorize aqui.
        </p>
      </PageHero>

      <div className="px-4 lg:px-6 xl:px-10 2xl:px-14">
      {error && (
        <p role="alert" className="mb-4 rounded-2xl border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mb-4 rounded-2xl border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-200">
          {notice}
        </p>
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
            disabled={loadingToken}
            className="flex min-h-[168px] flex-col items-start rounded-2xl border border-dashed border-zinc-800 bg-transparent p-4 text-left transition-colors hover:border-zinc-600 disabled:opacity-50"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 text-xl text-zinc-400">
              +
            </div>
            <p className="mt-6 text-[15px] font-semibold text-white">
              {loadingToken ? "Abrindo…" : "Adicionar banco"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Bradesco, Santander e outros pelo Meu Pluggy</p>
            <span className="mt-auto border-t border-zinc-800 pt-3 text-xs text-zinc-500">
              Ver passo a passo &gt;
            </span>
          </button>
        </div>
      </section>

      <section className="mt-10">
        <SectionLabel>Saldo em tempo real</SectionLabel>
        <Link
          href="/bancos/tempo-real"
          className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-900/60 bg-emerald-950/20 p-4 transition-colors hover:border-emerald-700"
        >
          <div>
            <p className="text-[15px] font-semibold text-white">⚡ Ver cada compra na hora — grátis</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              O Meu Pluggy atualiza 1x por dia. Encaminhe as notificações dos apps dos bancos pelo celular e o app
              registra na hora.
            </p>
          </div>
          <span className="shrink-0 text-xs text-emerald-300">Configurar &gt;</span>
        </Link>
      </section>

      {selected && (
        <DetailsPanel
          connection={selected}
          syncing={syncingId === selected.id}
          onClose={() => setSelectedId(null)}
          onSync={() => handleSync(selected.id)}
          onDisconnect={() => handleDisconnect(selected.id)}
          onReauthorize={() => {
            setSelectedId(null);
            void handleConnect({ mode: "update", itemId: selected.pluggy_item_id });
          }}
        />
      )}

      {addOpen && (
        <AddBankDialog
          busy={loadingToken}
          connectedNames={connectedNames}
          onClose={() => setAddOpen(false)}
          onBringBanks={() => void handleBringBanks()}
        />
      )}

      {connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          includeSandbox={false}
          {...(connectTarget.mode === "update"
            ? { updateItem: connectTarget.itemId }
            : { connectorIds: [200], selectedConnectorId: 200, forceOauthInBrowser: true })}
          products={["ACCOUNTS", "CREDIT_CARDS", "TRANSACTIONS", "INVESTMENTS"]}
          language="pt"
          theme="dark"
          onSuccess={handleSuccess}
          onError={() =>
            setError(
              "A janela do Meu Pluggy deu erro. Confira se o banco já aparece como conectado no meu.pluggy.ai e tente de novo.",
            )
          }
          onClose={() => setConnectToken(null)}
        />
      )}
      </div>
    </PageShell>
  );
}
