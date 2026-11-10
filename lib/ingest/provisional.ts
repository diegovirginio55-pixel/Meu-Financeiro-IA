import type { SupabaseClient } from "@supabase/supabase-js";
import type { Account, Card, Transaction } from "@/lib/finance/types";
import { connectionFreshness } from "@/lib/finance/connection-freshness";
import type { BalanceOverride } from "@/lib/finance/balance-override";

/**
 * Lançamentos "provisórios": vieram da notificação do app do banco no
 * celular, antes de a Pluggy trazer o lançamento oficial (o Meu Pluggy só
 * atualiza 1x por dia). Ficam na tabela de lançamentos normal, marcados por
 * pluggy_transaction_id = "notif:<hash>" — sem precisar de coluna nova.
 */
export const PROVISIONAL_PREFIX = "notif:";

/** Depois que a Pluggy tiver dados mais novos que a notificação (com folga), o provisório sem par sai. */
const STALE_AFTER_DATA_MS = 6 * 60 * 60 * 1000;

export function isProvisional(transaction: { pluggy_transaction_id?: string | null }): boolean {
  return Boolean(transaction.pluggy_transaction_id?.startsWith(PROVISIONAL_PREFIX));
}

type ProvisionalRow = Pick<
  Transaction,
  "id" | "amount" | "type" | "account_id" | "card_id" | "date" | "category" | "created_at" | "pluggy_transaction_id"
>;

const PROVISIONAL_FIELDS = "id, amount, type, account_id, card_id, date, category, created_at, pluggy_transaction_id";

export async function loadProvisional(supabase: SupabaseClient, userId?: string): Promise<ProvisionalRow[]> {
  let query = supabase.from("transactions").select(PROVISIONAL_FIELDS).like("pluggy_transaction_id", `${PROVISIONAL_PREFIX}%`);
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query.limit(500);
  if (error) {
    console.error("Erro ao ler lançamentos provisórios:", error);
    return [];
  }
  return (data ?? []) as ProvisionalRow[];
}

function dayDiff(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000;
}

/**
 * Chegaram lançamentos oficiais da Pluggy: troca os provisórios
 * correspondentes (mesma conta/cartão, mesmo tipo e valor, data próxima).
 * Se o usuário já tinha escolhido uma categoria no provisório, ela passa
 * para o oficial. Devolve os ids oficiais que tinham provisório — esses não
 * geram notificação de novo (o usuário já viu a do próprio banco).
 */
export async function reconcileProvisional(
  supabase: SupabaseClient,
  userId: string,
  target: { accountId: string | null; cardId: string | null },
  inserted: { id: string; amount: number; type: string; date: string; category: string }[],
): Promise<Set<string>> {
  const matched = new Set<string>();
  if (inserted.length === 0) return matched;
  const provisional = (await loadProvisional(supabase, userId)).filter(
    (row) =>
      (target.accountId && row.account_id === target.accountId) ||
      (target.cardId && row.card_id === target.cardId) ||
      (!row.account_id && !row.card_id),
  );
  if (provisional.length === 0) return matched;

  const used = new Set<string>();
  for (const official of inserted) {
    const candidate = provisional.find(
      (row) =>
        !used.has(row.id) &&
        row.type === official.type &&
        Math.abs(Number(row.amount) - Number(official.amount)) < 0.005 &&
        dayDiff(row.date, official.date) <= 2,
    );
    if (!candidate) continue;
    used.add(candidate.id);
    matched.add(official.id);
    const chosen = candidate.category && !["Outros", "Salário"].includes(candidate.category) ? candidate.category : null;
    if (chosen && chosen !== official.category) {
      await supabase.from("transactions").update({ category: chosen }).eq("id", official.id);
    }
  }
  if (used.size > 0) {
    const { error } = await supabase.from("transactions").delete().in("id", [...used]);
    if (error) console.error("Erro ao remover provisórios já confirmados pelo banco:", error);
  }
  return matched;
}

/**
 * Provisórios sem par há muito tempo: a Pluggy já tem dados bem mais novos
 * que a notificação e o lançamento oficial veio com valor/data diferentes.
 * Remove para não contar o gasto em dobro.
 */
export async function cleanupStaleProvisional(
  supabase: SupabaseClient,
  userId: string,
  target: { accountIds: string[]; cardIds: string[] },
  dataUpdatedAt: string | null | undefined,
): Promise<void> {
  if (!dataUpdatedAt) return;
  const limit = new Date(Date.parse(dataUpdatedAt) - STALE_AFTER_DATA_MS).toISOString();
  const stale = (await loadProvisional(supabase, userId)).filter(
    (row) =>
      row.created_at < limit &&
      ((row.account_id && target.accountIds.includes(row.account_id)) || (row.card_id && target.cardIds.includes(row.card_id))),
  );
  if (stale.length === 0) return;
  const { error } = await supabase.from("transactions").delete().in("id", stale.map((row) => row.id));
  if (error) console.error("Erro ao limpar provisórios antigos:", error);
}

/**
 * Saldo estimado: saldo que o banco informou + movimentações das
 * notificações que chegaram DEPOIS da última atualização da Pluggy (as
 * anteriores já estão no saldo do banco). Marca quanto foi ajustado em
 * provisional_delta para a tela poder avisar.
 *
 * Se o usuário corrigiu o saldo à mão depois da última atualização da
 * Pluggy, a base passa a ser o valor digitado, e só contam as notificações
 * que chegaram depois da correção (as anteriores já estavam no valor que ele
 * viu no banco). Quando a Pluggy trouxer dados mais novos, a correção deixa
 * de valer sozinha.
 */
export function applyProvisionalToBalances<A extends Account, C extends Card>(
  accounts: A[],
  cards: C[],
  provisional: ProvisionalRow[],
  connections: { id: string; status_detail?: string | null; last_synced_at?: string | null }[],
  overrides: ReadonlyMap<string, BalanceOverride> = new Map(),
): { accounts: A[]; cards: C[] } {
  if (provisional.length === 0 && overrides.size === 0) return { accounts, cards };
  const dataTimeByConnection = new Map(
    connections.map((connection) => [connection.id, connectionFreshness(connection).dataUpdatedAt]),
  );
  const time = (value: string | null | undefined) => (value ? Date.parse(value) : Number.NaN);
  const pending = (connectionId: string | null | undefined, createdAt: string) => {
    const dataTime = connectionId ? dataTimeByConnection.get(connectionId) : null;
    return !dataTime || time(createdAt) > time(dataTime);
  };
  const activeOverride = (account: A): BalanceOverride | null => {
    const override = overrides.get(account.id);
    if (!override) return null;
    const dataTime = account.bank_connection_id ? dataTimeByConnection.get(account.bank_connection_id) : null;
    return !dataTime || time(override.at) > time(dataTime) ? override : null;
  };

  const accountDelta = new Map<string, number>();
  const cardDelta = new Map<string, number>();
  for (const row of provisional) {
    const amount = Number(row.amount) || 0;
    if (row.account_id) {
      const account = accounts.find((item) => item.id === row.account_id);
      if (!account) continue;
      const override = activeOverride(account);
      const counts = override ? time(row.created_at) > time(override.at) : pending(account.bank_connection_id, row.created_at);
      if (!counts) continue;
      accountDelta.set(row.account_id, (accountDelta.get(row.account_id) ?? 0) + (row.type === "entrada" ? amount : -amount));
    } else if (row.card_id) {
      const card = cards.find((item) => item.id === row.card_id);
      if (!card || !pending(card.bank_connection_id, row.created_at)) continue;
      cardDelta.set(row.card_id, (cardDelta.get(row.card_id) ?? 0) + (row.type === "saida" ? amount : -amount));
    }
  }

  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    accounts: accounts.map((account) => {
      const delta = accountDelta.get(account.id) ?? 0;
      const override = activeOverride(account);
      if (!override && !delta) return account;
      const base = override ? override.balance : Number(account.balance);
      return {
        ...account,
        balance: round(base + delta),
        ...(delta ? { provisional_delta: round(delta) } : {}),
        ...(override ? { balance_override_at: override.at } : {}),
      };
    }),
    cards: cards.map((card) => {
      const delta = cardDelta.get(card.id);
      return delta
        ? { ...card, current_invoice: round(Math.max(0, Number(card.current_invoice) + delta)), provisional_delta: round(delta) }
        : card;
    }),
  };
}
