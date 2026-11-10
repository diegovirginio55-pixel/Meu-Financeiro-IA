import { createAdminClient } from "@/lib/supabase/admin";
import type { FutureInstallment } from "./card-installments";

/**
 * Parcelas futuras de cada cartão, calculadas na sincronização com a
 * Pluggy e guardadas em internal_settings (card_installments:<id do cartão>),
 * sem migration nova. Quem lê passa só ids de cartões já lidos com o login
 * do usuário (RLS).
 */
const PREFIX = "card_installments:";

export async function saveCardInstallments(cardId: string, items: FutureInstallment[]): Promise<void> {
  try {
    const admin = createAdminClient();
    const key = `${PREFIX}${cardId}`;
    if (items.length === 0) {
      await admin.from("internal_settings").delete().eq("key", key);
      return;
    }
    await admin
      .from("internal_settings")
      .upsert({ key, value: JSON.stringify(items.slice(0, 200)), updated_at: new Date().toISOString() }, { onConflict: "key" });
  } catch (error) {
    console.error("Erro ao guardar parcelas do cartão:", error);
  }
}

export async function loadCardInstallments(cardIds: string[]): Promise<Map<string, FutureInstallment[]>> {
  const result = new Map<string, FutureInstallment[]>();
  if (cardIds.length === 0) return result;
  try {
    const { data } = await createAdminClient()
      .from("internal_settings")
      .select("key, value")
      .in("key", cardIds.map((id) => `${PREFIX}${id}`));
    for (const row of data ?? []) {
      try {
        const items = JSON.parse(String(row.value)) as FutureInstallment[];
        if (Array.isArray(items)) result.set(String(row.key).slice(PREFIX.length), items);
      } catch {
        // valor corrompido: ignora
      }
    }
  } catch (error) {
    console.error("Erro ao ler parcelas do cartão:", error);
  }
  return result;
}
