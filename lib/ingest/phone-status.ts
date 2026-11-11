import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Último sinal do app Android (versão, se o leitor de notificações está
 * ligado e quando falou com o servidor). O app manda isso em todo envio e
 * num "estou vivo" a cada 6 horas. Serve para a tela mostrar se a leitura
 * está funcionando e para avisar quando o celular para de dar notícias —
 * antes só se descobria quando faltava um lançamento. Fica em
 * internal_settings, que só o servidor lê.
 */
export type PhoneStatus = {
  version: string;
  /** Acesso às notificações liberado e leitor conectado. */
  listener: boolean;
  /** Último contato do app com o servidor (ISO). */
  at: string;
};

/** Sem contato por mais que isso = o Android matou o app ou ele foi desinstalado. */
export const PHONE_SILENT_MS = 24 * 60 * 60 * 1000;

const key = (userId: string) => `phone_status:${userId}`;

export async function readPhoneStatus(supabase: SupabaseClient, userId: string): Promise<PhoneStatus | null> {
  const { data, error } = await supabase.from("internal_settings").select("value").eq("key", key(userId)).maybeSingle();
  if (error || !data) return null;
  try {
    const parsed = JSON.parse(String(data.value)) as Partial<PhoneStatus>;
    if (typeof parsed.version !== "string" || typeof parsed.at !== "string") return null;
    return { version: parsed.version, listener: parsed.listener === true, at: parsed.at };
  } catch {
    return null;
  }
}

export async function recordPhoneStatus(
  supabase: SupabaseClient,
  userId: string,
  status: { version: string; listener: boolean },
  now = new Date(),
): Promise<void> {
  const value: PhoneStatus = { version: status.version.slice(0, 20), listener: status.listener, at: now.toISOString() };
  const { error } = await supabase
    .from("internal_settings")
    .upsert({ key: key(userId), value: JSON.stringify(value), updated_at: value.at }, { onConflict: "key" });
  if (error) console.error("Erro ao guardar o estado do app Android:", error);
}

export type PhoneProblem = { kind: "phone_listener_off" | "phone_silent"; title: string; body: string };

/** Problema na leitura do celular que merece um aviso (null se está tudo bem ou se o app novo nunca foi usado). */
export function phoneProblem(status: PhoneStatus | null, now = new Date()): PhoneProblem | null {
  if (!status) return null;
  if (now.getTime() - Date.parse(status.at) > PHONE_SILENT_MS) {
    return {
      kind: "phone_silent",
      title: "O celular parou de mandar os avisos dos bancos 📵",
      body: "Faz mais de um dia que o app Android não dá sinal. Abra “Leitura dos bancos” no celular para religar — sem isso o saldo só atualiza 1x por dia.",
    };
  }
  if (!status.listener) {
    return {
      kind: "phone_listener_off",
      title: "A leitura dos avisos dos bancos está desligada ⚠️",
      body: "O app Android perdeu o acesso às notificações. Abra “Leitura dos bancos” no celular e toque em Liberar acesso.",
    };
  }
  return null;
}

export type PhoneView = { version: string; listener: boolean; ago: string; silent: boolean };

/** Estado do app para a tela "Saldo em tempo real": versão, leitor e há quanto tempo deu sinal. */
export function phoneView(status: PhoneStatus | null, now = new Date()): PhoneView | null {
  if (!status) return null;
  const elapsed = Math.max(0, now.getTime() - Date.parse(status.at));
  const minutes = Math.round(elapsed / 60_000);
  const hours = Math.round(minutes / 60);
  const ago = minutes < 2 ? "agora há pouco" : minutes < 60 ? `há ${minutes} min` : hours < 48 ? `há ${hours} h` : `há ${Math.round(hours / 24)} dias`;
  return { version: status.version, listener: status.listener, ago, silent: elapsed > PHONE_SILENT_MS };
}
