import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Nome do titular das contas conectadas (vem da Pluggy a cada sync). Serve
 * para reconhecer Pix/transferência para o próprio nome — que não é gasto —
 * nos avisos do celular, que não trazem CPF. Fica em internal_settings, que
 * só o servidor lê.
 */
const key = (userId: string) => `owner_names:${userId}`;
const MAX_NAMES = 6;

export async function loadOwnerNames(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("internal_settings").select("value").eq("key", key(userId)).maybeSingle();
  if (error || !data) return [];
  try {
    const parsed = JSON.parse(String(data.value)) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Junta os titulares informados pelo banco aos já conhecidos (só grava se mudou). */
export async function rememberOwnerNames(
  supabase: SupabaseClient,
  userId: string,
  owners: Array<string | null | undefined>,
): Promise<void> {
  const incoming = owners.map((owner) => normalizeName(owner ?? "")).filter((owner) => owner.split(" ").length >= 2);
  if (incoming.length === 0) return;
  const current = await loadOwnerNames(supabase, userId);
  const merged = Array.from(new Set([...current, ...incoming])).slice(0, MAX_NAMES);
  if (merged.length === current.length && merged.every((name, index) => name === current[index])) return;
  const { error } = await supabase
    .from("internal_settings")
    .upsert({ key: key(userId), value: JSON.stringify(merged), updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) console.error("Erro ao guardar o nome do titular:", error);
}
