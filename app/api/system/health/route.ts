import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "@/lib/supabase/schema-compat";

/**
 * Última vez que o cron de sincronização rodou (lastRunAt), última vez que o
 * sync com os bancos funcionou (lastOkAt) e o último erro, pra o app avisar
 * se algo parar.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let result = await supabase
    .from("system_heartbeats")
    .select("last_run_at, last_ok_at, last_error")
    .eq("key", "bank_cron")
    .maybeSingle();
  if (result.error && isMissingSchemaError(result.error)) {
    result = await supabase.from("system_heartbeats").select("last_run_at").eq("key", "bank_cron").maybeSingle();
  }
  const row = (result.data ?? null) as { last_run_at?: string; last_ok_at?: string | null; last_error?: string | null } | null;

  return NextResponse.json(
    {
      lastRunAt: row?.last_run_at ?? null,
      lastOkAt: row?.last_ok_at ?? null,
      lastError: row?.last_error ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
