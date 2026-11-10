import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serverError } from "@/lib/api/errors";
import { realConnectionId } from "@/lib/finance/connection-filter";
import { daysAgoKey, saoPauloTodayKey } from "@/lib/finance/fluxo";
import { dailyBalanceHistory, type BalanceSnapshotRow } from "@/lib/finance/balance-history";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

const MAX_DAYS = 90;

/**
 * Evolução diária do saldo em conta (todas as contas, ou de um banco com
 * ?banco=<id>), para o gráfico da tela inicial. Dia sem foto de uma conta
 * repete o último saldo conhecido dela (ver dailyBalanceHistory).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const days = Math.min(MAX_DAYS, Math.max(7, Number(url.searchParams.get("dias")) || 30));
  const bank = url.searchParams.get("banco");
  // Uma semana antes do período, para já começar com o último saldo de cada conta.
  const from = daysAgoKey(days + 7);
  const start = daysAgoKey(days);
  const today = saoPauloTodayKey();

  const { data: rows, error } = await fetchAllRows<BalanceSnapshotRow>((rangeStart, rangeEnd) => {
    let query = supabase
      .from("account_balance_snapshots")
      .select("account_id, snapshot_date, balance")
      .gte("snapshot_date", from);
    if (bank && bank !== "all") query = query.eq("bank_connection_id", realConnectionId(bank));
    return query
      .order("snapshot_date", { ascending: true })
      .order("account_id", { ascending: true })
      .range(rangeStart, rangeEnd);
  });
  if (error) return serverError("Não foi possível carregar o histórico do saldo.", error);

  return NextResponse.json({ history: dailyBalanceHistory(rows, start, today) });
}
