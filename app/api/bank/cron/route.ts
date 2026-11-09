import { createHash, timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshBankConnections } from "@/lib/pluggy/auto-refresh";
import { publicOrigin } from "@/lib/pluggy/origin";
import { ensureAppWebhook, webhookUrlFor } from "@/lib/pluggy/webhook";
import { runAlertsAndSummaries } from "@/lib/push/alerts-runner";
import { recordHeartbeat } from "@/lib/system/heartbeat";

export const maxDuration = 300;

/** Execuções sobrepostas no mesmo servidor (cron atrasado + o seguinte) não rodam em dobro. */
let running = false;

function sameSecret(received: string | null, secret: string): boolean {
  if (!received) return false;
  // Compara hashes de tamanho fixo em tempo constante.
  const a = createHash("sha256").update(received).digest();
  const b = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(a, b);
}

const TOKEN_CACHE_MS = 5 * 60 * 1000;
let cachedInternalToken: { value: string | null; at: number } | null = null;

/**
 * Token gerado pela migration 0011 e usado pelo pg_cron do Supabase (tabela
 * internal_settings, que só o servidor lê). Evita ter de copiar o
 * BANK_CRON_SECRET para dentro do banco.
 */
async function internalCronToken(supabase: SupabaseClient): Promise<string | null> {
  if (cachedInternalToken && Date.now() - cachedInternalToken.at < TOKEN_CACHE_MS) return cachedInternalToken.value;
  const { data, error } = await supabase
    .from("internal_settings")
    .select("value")
    .eq("key", "cron_token")
    .maybeSingle();
  const value = error ? null : ((data?.value as string | undefined) ?? null);
  cachedInternalToken = { value, at: Date.now() };
  return value;
}

async function isAuthorized(request: Request, supabase: SupabaseClient): Promise<boolean> {
  const received = request.headers.get("authorization");
  if (!received) return false;
  const secret = process.env.BANK_CRON_SECRET;
  if (secret && sameSecret(received, secret)) return true;
  const token = await internalCronToken(supabase);
  return Boolean(token && sameSecret(received, token));
}

async function runCronJobs(supabase: SupabaseClient, origin: string | null) {
  const errors: string[] = [];

  try {
    await ensureAppWebhook(webhookUrlFor(origin));
  } catch (error) {
    errors.push(`webhook: ${error instanceof Error ? error.message : String(error)}`);
    console.error("Erro ao registrar webhook de aplicação na Pluggy:", error);
  }

  const { data: connections, error: connectionsError } = await supabase.from("bank_connections").select("*");
  if (connectionsError) {
    errors.push(`conexões: ${connectionsError.message}`);
    console.error("Erro ao listar conexões no cron:", connectionsError);
  }

  const result = await refreshBankConnections({
    supabase,
    connections: connections ?? [],
    webhookUrl: webhookUrlFor(origin),
  });
  if (result.failed > 0) errors.push(`${result.failed} banco(s) falharam ao sincronizar`);

  try {
    await runAlertsAndSummaries(supabase);
  } catch (error) {
    errors.push("alertas");
    console.error("Erro ao rodar alertas inteligentes:", error);
  }

  const syncWorked = result.failed === 0 || result.pulled > 0;
  await recordHeartbeat(supabase, "bank_cron", {
    ...(syncWorked ? { last_ok_at: new Date().toISOString() } : {}),
    last_error: errors.length > 0 ? errors.join(" · ").slice(0, 500) : null,
  });
}

/**
 * Atualização em segundo plano, mesmo com o app fechado. Um cron externo
 * (GitHub Actions) chama GET neste endereço com Authorization: Bearer
 * BANK_CRON_SECRET.
 *
 * Responde na hora (202) e faz o trabalho em seguida: antes o cron esperava
 * todos os syncs terminarem e estourava o limite de 90 s do GitHub Actions.
 */
export async function GET(request: Request) {
  const supabase = createAdminClient();
  if (!(await isAuthorized(request, supabase))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await recordHeartbeat(supabase, "bank_cron", { last_run_at: new Date().toISOString() });

  if (running) {
    return NextResponse.json({ ok: true, skipped: "já em execução" }, { status: 202 });
  }

  const origin = publicOrigin(request);
  running = true;
  after(async () => {
    try {
      await runCronJobs(supabase, origin);
    } catch (error) {
      console.error("Erro no cron de sincronização:", error);
      await recordHeartbeat(supabase, "bank_cron", {
        last_error: error instanceof Error ? error.message.slice(0, 500) : "erro desconhecido",
      });
    } finally {
      running = false;
    }
  });

  return NextResponse.json({ ok: true, accepted: true }, { status: 202 });
}
