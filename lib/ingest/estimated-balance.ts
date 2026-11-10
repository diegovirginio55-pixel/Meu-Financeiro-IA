import type { SupabaseClient } from "@supabase/supabase-js";
import { applyProvisionalToBalances, loadProvisional } from "./provisional";
import { loadBalanceOverrides } from "@/lib/finance/balance-override";
import type { Account } from "@/lib/finance/types";

export type EstimatedBalance = {
  /** Saldo em conta dos bancos conectados, com as notificações do celular e as correções à mão. */
  balance: number;
  /** Mesmas contas, já ajustadas (para mostrar o saldo de um banco). */
  accounts: Account[];
  /** Contas como a Pluggy trouxe (sem ajuste) — base do "limite de hoje". */
  rawAccounts: Account[];
};

/**
 * Saldo que a tela inicial mostra: soma das contas dos bancos conectados,
 * com as movimentações das notificações que chegaram depois da última
 * atualização do banco e as correções feitas em "Corrigir saldo".
 */
export async function loadEstimatedBalance(supabase: SupabaseClient, userId: string): Promise<EstimatedBalance | null> {
  const [connectionsRes, accountsRes, provisional] = await Promise.all([
    supabase.from("bank_connections").select("id, status_detail, last_synced_at").eq("user_id", userId),
    supabase.from("accounts").select("*").eq("user_id", userId),
    loadProvisional(supabase, userId),
  ]);
  if (connectionsRes.error || accountsRes.error) return null;

  const connections = connectionsRes.data ?? [];
  const connectionIds = new Set(connections.map((connection) => connection.id));
  const rawAccounts = (accountsRes.data ?? []) as Account[];
  const { accounts } = applyProvisionalToBalances(
    rawAccounts,
    [],
    provisional,
    connections,
    await loadBalanceOverrides(rawAccounts.map((account) => account.id)),
  );
  const balance = accounts
    .filter((account) => account.bank_connection_id && connectionIds.has(account.bank_connection_id))
    .reduce((sum, account) => sum + Number(account.balance), 0);
  return { balance: Math.round(balance * 100) / 100, accounts, rawAccounts };
}
