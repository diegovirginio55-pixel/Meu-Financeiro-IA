import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyIngestToken } from "@/lib/ingest/token";
import { loadEstimatedBalance } from "@/lib/ingest/estimated-balance";
import { isGasto, saoPauloTodayKey } from "@/lib/finance/fluxo";
import type { Transaction } from "@/lib/finance/types";

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
  const [estimate, todayRes] = await Promise.all([
    loadEstimatedBalance(supabase, userId),
    supabase.from("transactions").select("*").eq("user_id", userId).eq("date", today),
  ]);
  if (!estimate) {
    return NextResponse.json({ error: "Não foi possível ler o saldo." }, { status: 500 });
  }

  const todaySpent = ((todayRes.data ?? []) as Transaction[])
    .filter(isGasto)
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

  return NextResponse.json(
    { balance: estimate.balance, todaySpent: Math.round(todaySpent * 100) / 100, at: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
