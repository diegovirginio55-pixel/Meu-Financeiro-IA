import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshBankConnections } from "@/lib/pluggy/auto-refresh";
import { publicOrigin } from "@/lib/pluggy/origin";

/**
 * Atualização em segundo plano, mesmo com o app fechado.
 * Configure um cron (Render/GitHub Actions) para GET neste endereço
 * com Authorization: Bearer BANK_CRON_SECRET.
 */
export async function GET(request: Request) {
  const secret = process.env.BANK_CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: connections } = await supabase.from("bank_connections").select("*");
  const origin = publicOrigin(request);
  const result = await refreshBankConnections({
    supabase,
    connections: connections ?? [],
    webhookUrl: origin ? `${origin}/api/bank/webhook` : undefined,
  });

  return NextResponse.json(result);
}
