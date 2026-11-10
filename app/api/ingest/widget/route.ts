import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyIngestToken } from "@/lib/ingest/token";
import { applyProvisionalToBalances, loadProvisional } from "@/lib/ingest/provisional";
import { loadBalanceOverrides } from "@/lib/finance/balance-override";
import { isGasto, saoPauloTodayKey } from "@/lib/finance/fluxo";
import type { Account, Transaction } from "@/lib/finance/types";

/**
 * Dados do widget do app Android (tela inicial do celular): saldo em conta
 * (o mesmo da tela inicial, com notificações e correções) e gastos de hoje.
 * Sem login: autorizado pelo link pessoal do "Saldo em tempo real"
 * (?token=…), que o app já guardou no "Ativar neste celular".
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const userId = await verifyIngestToken(url.searchParams.get("token") ?? bearer);
  if (!userId) return NextResponse.json({ error: "Token inválido." }, { status: 401 });

  const supabase = createAdminClient();
  const today = saoPauloTodayKey();
  const [connectionsRes, accountsRes, provisional, todayRes] = await Promise.all([
    supabase.from("bank_connections").select("id, status_detail, last_synced_at").eq("user_id", userId),
    supabase.from("accounts").select("*").eq("user_id", userId),
    loadProvisional(supabase, userId),
    supabase.from("transactions").select("*").eq("user_id", userId).eq("date", today),
  ]);
  if (connectionsRes.error || accountsRes.error) {
    return NextResponse.json({ error: "Não foi possível ler o saldo." }, { status: 500 });
  }

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
  // Igual à tela inicial: soma as contas dos bancos conectados.
  const balance = accounts
    .filter((account) => account.bank_connection_id && connectionIds.has(account.bank_connection_id))
    .reduce((sum, account) => sum + Number(account.balance), 0);
  const todaySpent = ((todayRes.data ?? []) as Transaction[])
    .filter(isGasto)
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

  return NextResponse.json(
    { balance: Math.round(balance * 100) / 100, todaySpent: Math.round(todaySpent * 100) / 100, at: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
