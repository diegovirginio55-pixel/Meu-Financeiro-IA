import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchemaError } from "@/lib/supabase/schema-compat";

export interface TransactionEffect {
  account_id: string | null;
  card_id: string | null;
  type: "entrada" | "saida";
  amount: number;
}

type Target = { kind: "account" | "card"; id: string };

/**
 * Efeito de um lançamento em cada saldo: uma "entrada" soma no saldo da
 * conta e uma "saida" subtrai. No cartão é o contrário: uma "saida" (compra)
 * aumenta a fatura e uma "entrada" (estorno/pagamento) reduz.
 */
function effectDeltas(effect: TransactionEffect | null, sign: 1 | -1, into: Map<string, number>) {
  if (!effect) return;
  const amount = Number(effect.amount);
  if (!Number.isFinite(amount) || amount === 0) return;
  if (effect.account_id) {
    const key = `account:${effect.account_id}`;
    const delta = effect.type === "entrada" ? amount : -amount;
    into.set(key, (into.get(key) ?? 0) + sign * delta);
  }
  if (effect.card_id) {
    const key = `card:${effect.card_id}`;
    const delta = effect.type === "saida" ? amount : -amount;
    into.set(key, (into.get(key) ?? 0) + sign * delta);
  }
}

function parseTarget(key: string): Target {
  const [kind, id] = key.split(":") as ["account" | "card", string];
  return { kind, id };
}

async function adjust(supabase: SupabaseClient, target: Target, delta: number): Promise<void> {
  const table = target.kind === "account" ? "accounts" : "cards";
  const column = target.kind === "account" ? "balance" : "current_invoice";

  // Contas e cartões sincronizados com o banco têm o saldo real vindo da
  // Pluggy; ajustar aqui deixaria o número errado até o próximo sync.
  const { data: row, error: readError } = await supabase
    .from(table)
    .select(`${column}, source`)
    .eq("id", target.id)
    .maybeSingle();
  if (readError) throw readError;
  if (!row) return;
  if ((row as { source?: string | null }).source === "pluggy") return;

  const rpc = target.kind === "account" ? "adjust_account_balance" : "adjust_card_invoice";
  const param = target.kind === "account" ? "p_account_id" : "p_card_id";
  const { error: rpcError } = await supabase.rpc(rpc, { [param]: target.id, p_delta: delta });
  if (!rpcError) return;
  if (!isMissingSchemaError(rpcError)) throw rpcError;

  // Migration 0010 ainda não aplicada: lê e grava (não atômico, mas correto).
  const current = Number((row as Record<string, unknown>)[column]) || 0;
  const next = target.kind === "card" ? Math.max(0, current + delta) : current + delta;
  const { error: updateError } = await supabase
    .from(table)
    .update({ [column]: Math.round(next * 100) / 100, updated_at: new Date().toISOString() })
    .eq("id", target.id);
  if (updateError) throw updateError;
}

/**
 * Reajusta saldo da conta e fatura do cartão quando um lançamento é criado,
 * editado ou excluído. Recebe o estado antes e depois (null = não existia /
 * não existe mais) e aplica só a diferença líquida, uma vez por conta/cartão.
 * Assim, editar só a descrição, a categoria ou a data não mexe em saldo.
 */
export async function applyTransactionChange(
  supabase: SupabaseClient,
  before: TransactionEffect | null,
  after: TransactionEffect | null,
): Promise<void> {
  const deltas = new Map<string, number>();
  effectDeltas(before, -1, deltas);
  effectDeltas(after, 1, deltas);

  for (const [key, rawDelta] of deltas) {
    const delta = Math.round(rawDelta * 100) / 100;
    if (Math.abs(delta) < 0.005) continue;
    await adjust(supabase, parseTarget(key), delta);
  }
}
