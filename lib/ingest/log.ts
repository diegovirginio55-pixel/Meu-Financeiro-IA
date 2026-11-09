import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Últimas notificações que chegaram do celular (por usuário, só as 10 mais
 * recentes) — para a tela de configuração mostrar se o MacroDroid/Atalhos
 * está funcionando e como cada aviso foi entendido. Fica em
 * internal_settings, que só o servidor lê.
 */
export type IngestLogEntry = {
  at: string;
  app: string;
  preview: string;
  result: "registrado" | "duplicado" | "ignorado" | "teste";
  detail: string;
};

const MAX_ENTRIES = 10;
const logKey = (userId: string) => `ingest_log:${userId}`;

export async function readIngestLog(userId: string): Promise<IngestLogEntry[]> {
  const { data, error } = await createAdminClient()
    .from("internal_settings")
    .select("value")
    .eq("key", logKey(userId))
    .maybeSingle();
  if (error || !data) return [];
  try {
    const parsed = JSON.parse(String(data.value)) as IngestLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function appendIngestLog(userId: string, entry: Omit<IngestLogEntry, "at">): Promise<void> {
  try {
    const current = await readIngestLog(userId);
    const next = [{ ...entry, at: new Date().toISOString() }, ...current].slice(0, MAX_ENTRIES);
    await createAdminClient()
      .from("internal_settings")
      .upsert({ key: logKey(userId), value: JSON.stringify(next), updated_at: new Date().toISOString() }, { onConflict: "key" });
  } catch (error) {
    console.error("Erro ao registrar log de notificações:", error);
  }
}
