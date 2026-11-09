import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchemaError } from "@/lib/supabase/schema-compat";
import {
  CHAT_DAILY_LIMIT,
  CHAT_QUOTA_COOKIE,
  parseQuotaCookie,
  serializeQuotaCookie,
  type ChatQuotaState,
} from "./quota";

type UsageRow = { used: number; lock_until: string | null };

function laterOf(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

/**
 * Cota de perguntas do dia. Fica no banco (tabela chat_usage, por usuário)
 * — antes ficava só num cookie, que zerava ao limpar o navegador, usar aba
 * anônima ou outro aparelho. O cookie continua como reserva enquanto a
 * migration 0010 não tiver sido aplicada; com as duas fontes, vale a maior.
 */
export async function readChatQuota(supabase: SupabaseClient, userId: string): Promise<ChatQuotaState> {
  const jar = await cookies();
  const fromCookie = parseQuotaCookie(jar.get(CHAT_QUOTA_COOKIE)?.value);

  const { data, error } = await supabase
    .from("chat_usage")
    .select("used, lock_until")
    .eq("user_id", userId)
    .eq("period_key", fromCookie.period)
    .maybeSingle<UsageRow>();
  if (error) {
    if (!isMissingSchemaError(error)) console.error("Erro ao ler cota do chat:", error);
    return fromCookie;
  }
  if (!data) return fromCookie;

  return {
    period: fromCookie.period,
    used: Math.min(CHAT_DAILY_LIMIT, Math.max(Number(data.used) || 0, fromCookie.used)),
    lockUntil: laterOf(data.lock_until, fromCookie.lockUntil),
  };
}

export async function writeChatQuota(supabase: SupabaseClient, userId: string, state: ChatQuotaState): Promise<void> {
  const jar = await cookies();
  jar.set(CHAT_QUOTA_COOKIE, serializeQuotaCookie(state), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 48,
  });

  const { error } = await supabase.from("chat_usage").upsert(
    {
      user_id: userId,
      period_key: state.period,
      used: state.used,
      lock_until: state.lockUntil,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,period_key" },
  );
  if (error && !isMissingSchemaError(error)) console.error("Erro ao gravar cota do chat:", error);
}
