import type { SupabaseClient } from "@supabase/supabase-js";
import { counterpartyFromDescription, isGenericCategory } from "./categories";

const UPDATE_CHUNK = 150;

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type LearnedCategory = {
  /** Nome de quem recebeu/pagou, se a descrição trazia um ("izoleide mangueira da cruz"). */
  counterparty: string | null;
  /** Quantos outros lançamentos dessa pessoa (que estavam em "Outros"/"Salário") mudaram junto. */
  updated: number;
};

/**
 * O usuário escolheu a categoria de um Pix/transferência para alguém: vira
 * regra — os próximos para a mesma pessoa já chegam na categoria certa — e
 * os lançamentos antigos dessa pessoa (do mesmo tipo) que ainda estão em
 * "Outros"/"Salário" recebem a mesma categoria. Descrição sem nome ("DEB
 * PIX CHAVE", "COMPRA CARTAO DEBITO") não vira regra: pegaria tudo.
 */
export async function learnCategoryChoice(
  supabase: SupabaseClient,
  userId: string,
  transaction: { id: string; description: string; type: string },
  category: string,
): Promise<LearnedCategory> {
  const counterparty = counterpartyFromDescription(transaction.description);
  if (!counterparty || isGenericCategory(category)) return { counterparty, updated: 0 };

  try {
    const { data: rules } = await supabase.from("category_rules").select("id, pattern, category").eq("user_id", userId);
    const existing = (rules ?? []).find((rule) => normalize(String(rule.pattern)) === counterparty);
    if (!existing) {
      await supabase.from("category_rules").insert({ user_id: userId, pattern: counterparty, category });
    } else if (existing.category !== category) {
      await supabase.from("category_rules").update({ category }).eq("id", existing.id);
    }

    // Busca pelo pedaço mais longo do nome (o ilike não ignora acento) e confere o nome inteiro aqui.
    const anchor = counterparty.split(" ").sort((a, b) => b.length - a.length)[0];
    const { data: candidates } = await supabase
      .from("transactions")
      .select("id, description")
      .eq("user_id", userId)
      .eq("type", transaction.type)
      .in("category", ["Outros", "Salário"])
      .ilike("description", `%${anchor}%`)
      .neq("id", transaction.id)
      .limit(500);
    const ids = (candidates ?? [])
      .filter((row) => normalize(String(row.description)).includes(counterparty))
      .map((row) => row.id as string);
    let updated = 0;
    for (let index = 0; index < ids.length; index += UPDATE_CHUNK) {
      const { data } = await supabase
        .from("transactions")
        .update({ category })
        .in("id", ids.slice(index, index + UPDATE_CHUNK))
        .eq("user_id", userId)
        .select("id");
      updated += data?.length ?? 0;
    }
    return { counterparty, updated };
  } catch (error) {
    console.error("Erro ao aprender a categoria escolhida:", error);
    return { counterparty, updated: 0 };
  }
}

/** "izoleide mangueira da cruz" → "Izoleide Mangueira da Cruz" (para mostrar na confirmação). */
export function displayName(counterparty: string): string {
  return counterparty
    .split(" ")
    .map((word) => (["da", "de", "do", "das", "dos", "e"].includes(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

/** Linha extra da confirmação: "E mais 3 lançamentos de Izoleide…; os próximos já chegam assim." */
export function learnedMessage(learned: LearnedCategory): string {
  if (!learned.counterparty) return "";
  const name = displayName(learned.counterparty);
  if (learned.updated > 0) {
    const plural = learned.updated === 1 ? "lançamento" : "lançamentos";
    return `Também mudei ${learned.updated} ${plural} de ${name}; os próximos já chegam assim.`;
  }
  return `Os próximos de ${name} já chegam assim.`;
}
