import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Expõe a última vez que o cron de sincronização bancária rodou, pra o app avisar se ele parar. */
export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data } = await supabase
    .from("system_heartbeats")
    .select("last_run_at")
    .eq("key", "bank_cron")
    .maybeSingle();

  return NextResponse.json({ lastRunAt: data?.last_run_at ?? null });
}
