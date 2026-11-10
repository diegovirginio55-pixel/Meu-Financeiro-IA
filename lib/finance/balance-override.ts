import { createAdminClient } from "@/lib/supabase/admin";

/**
 * "Corrigir saldo": o saldo que o usuário vê no app do banco, digitado à
 * mão. Vale até a Pluggy trazer dados mais novos que ele (o Meu Pluggy só
 * atualiza 1x por dia) — aí volta sozinho ao saldo oficial. Fica em
 * internal_settings (só o servidor lê), por conta: balance_override:<id da conta>.
 * Quem chama só passa ids de contas já lidas com o login do usuário (RLS).
 */
export type BalanceOverride = { balance: number; at: string };

const PREFIX = "balance_override:";
const keyFor = (accountId: string) => `${PREFIX}${accountId}`;

export function parseBalanceOverride(value: unknown): BalanceOverride | null {
  try {
    const parsed = JSON.parse(String(value)) as { balance?: unknown; at?: unknown };
    const balance = Number(parsed.balance);
    if (!Number.isFinite(balance) || typeof parsed.at !== "string" || Number.isNaN(Date.parse(parsed.at))) return null;
    return { balance, at: parsed.at };
  } catch {
    return null;
  }
}

export async function loadBalanceOverrides(accountIds: string[]): Promise<Map<string, BalanceOverride>> {
  const result = new Map<string, BalanceOverride>();
  if (accountIds.length === 0) return result;
  try {
    const { data, error } = await createAdminClient()
      .from("internal_settings")
      .select("key, value")
      .in("key", accountIds.map(keyFor));
    if (error || !data) return result;
    for (const row of data) {
      const override = parseBalanceOverride(row.value);
      if (override) result.set(String(row.key).slice(PREFIX.length), override);
    }
  } catch (error) {
    console.error("Erro ao ler saldos corrigidos:", error);
  }
  return result;
}

/** Grava o saldo informado agora; `null` desfaz (volta ao saldo do banco). */
export async function saveBalanceOverride(accountId: string, balance: number | null): Promise<void> {
  const admin = createAdminClient();
  if (balance === null) {
    const { error } = await admin.from("internal_settings").delete().eq("key", keyFor(accountId));
    if (error) throw error;
    return;
  }
  const now = new Date().toISOString();
  const { error } = await admin
    .from("internal_settings")
    .upsert({ key: keyFor(accountId), value: JSON.stringify({ balance, at: now }), updated_at: now }, { onConflict: "key" });
  if (error) throw error;
}
