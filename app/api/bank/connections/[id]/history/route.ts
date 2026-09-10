import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { realConnectionId } from "@/lib/finance/connection-filter";
import { daysAgoKey } from "@/lib/finance/fluxo";

/** Evolução diária do saldo somado das contas de uma conexão bancária (últimos 60 dias). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const from = daysAgoKey(60);
  const { data, error } = await supabase
    .from("account_balance_snapshots")
    .select("snapshot_date, balance")
    .eq("bank_connection_id", realConnectionId(id))
    .gte("snapshot_date", from)
    .order("snapshot_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const byDate = new Map<string, number>();
  for (const row of data ?? []) {
    byDate.set(row.snapshot_date, (byDate.get(row.snapshot_date) ?? 0) + Number(row.balance));
  }

  const history = Array.from(byDate.entries()).map(([date, balance]) => ({ date, balance }));

  return NextResponse.json({ history });
}
