import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serverError } from "@/lib/api/errors";
import { realConnectionId } from "@/lib/finance/connection-filter";
import { daysAgoKey, saoPauloTodayKey } from "@/lib/finance/fluxo";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

const MAX_DAYS = 90;

type SnapshotRow = { account_id: string; snapshot_date: string; balance: number | string };

/** Dias entre duas datas "AAAA-MM-DD", inclusive. */
function dayKeys(from: string, to: string): string[] {
  const keys: string[] = [];
  const cursor = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (cursor <= end && keys.length <= MAX_DAYS + 1) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

/**
 * Evolução diária do saldo em conta (todas as contas, ou de um banco com
 * ?banco=<id>), para o gráfico da tela inicial. Dia sem foto de uma conta
 * repete o último saldo conhecido dela — senão a soma "despencava" nos dias
 * em que um banco não atualizou.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const days = Math.min(MAX_DAYS, Math.max(7, Number(url.searchParams.get("dias")) || 30));
  const bank = url.searchParams.get("banco");
  // Um dia antes do período, para já começar com o último saldo de cada conta.
  const from = daysAgoKey(days + 7);
  const start = daysAgoKey(days);
  const today = saoPauloTodayKey();

  const { data: rows, error } = await fetchAllRows<SnapshotRow>((rangeStart, rangeEnd) => {
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

  const byDate = new Map<string, SnapshotRow[]>();
  for (const row of rows) {
    const list = byDate.get(row.snapshot_date) ?? [];
    list.push(row);
    byDate.set(row.snapshot_date, list);
  }

  const lastByAccount = new Map<string, number>();
  const history: { date: string; balance: number }[] = [];
  for (const key of dayKeys(from, today)) {
    for (const row of byDate.get(key) ?? []) lastByAccount.set(row.account_id, Number(row.balance) || 0);
    if (key < start || lastByAccount.size === 0) continue;
    const total = Array.from(lastByAccount.values()).reduce((sum, value) => sum + value, 0);
    history.push({ date: key, balance: Math.round(total * 100) / 100 });
  }

  return NextResponse.json({ history });
}
