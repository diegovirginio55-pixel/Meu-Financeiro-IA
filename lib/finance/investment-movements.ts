import type { SupabaseClient } from "@supabase/supabase-js";
import { inferInstitutionName, withInstitutionPrefix } from "@/lib/pluggy/institution";
import type { Account, Investment, Transaction } from "./types";

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^[^·•]+[·•]\s*/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasInvestmentProduct(text: string): boolean {
  return (
    /renda fixa/.test(text) ||
    /\b(lci|lca|cdb|lcd|cri|cra|tesouro)\b/.test(text) ||
    /debenture/.test(text) ||
    /tesouro direto/.test(text) ||
    /previdencia/.test(text)
  );
}

export function isInvestmentDescription(description: string): boolean {
  const text = normalizeText(description);
  if (!text) return false;
  if (hasInvestmentProduct(text)) return true;
  if (/aplicacao/.test(text) && (/fundo/.test(text) || /investimento/.test(text))) return true;
  if (/resgate/.test(text) && (hasInvestmentProduct(text) || /fundo|investimento/.test(text))) return true;
  return false;
}

export function isInvestmentMovement(transaction: Pick<Transaction, "category" | "description">): boolean {
  if (transaction.category === "Investimentos") return true;
  return isInvestmentDescription(transaction.description);
}

export function investmentNameFromDescription(description: string): string {
  const cleaned = description
    .replace(/d[eé]bito\s*/gi, "")
    .replace(/cr[eé]dito\s*/gi, "")
    .replace(/renda\s*fixa\s*-?\s*/gi, "")
    .replace(/aplica[cç][aã]o(\s+em)?\s*/gi, "")
    .replace(/resgate(\s+de)?\s*/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—]+|[\s\-–—]+$/g, "")
    .trim();
  return cleaned || description.trim();
}

export function investmentTypeFromDescription(description: string): string {
  const text = normalizeText(description);
  if (/\blci\b/.test(text)) return "LCI";
  if (/\blca\b/.test(text)) return "LCA";
  if (/\blcd\b/.test(text)) return "LCD";
  if (/\bcdb\b/.test(text)) return "CDB";
  if (/tesouro/.test(text)) return "Tesouro";
  if (/previdencia/.test(text)) return "Previdência";
  if (/fundo/.test(text)) return "Fundo";
  return "Renda Fixa";
}

export async function promoteInvestmentsFromTransactions(
  supabase: SupabaseClient,
  accounts: Account[],
  investments: Investment[],
): Promise<Investment[]> {
  const { data } = await supabase
    .from("transactions")
    .select("id, user_id, description, amount, type, category, account_id, date")
    .eq("type", "saida");
  const applications = ((data ?? []) as Transaction[]).filter((item) =>
    isInvestmentDescription(item.description),
  );
  if (applications.length === 0) return investments;

  const recategorizeIds = applications
    .filter((item) => item.category !== "Investimentos")
    .map((item) => item.id);
  if (recategorizeIds.length > 0) {
    await supabase.from("transactions").update({ category: "Investimentos" }).in("id", recategorizeIds);
  }

  const grouped = new Map<
    string,
    { name: string; amount: number; userId: string; accountId: string | null; type: string }
  >();

  for (const transaction of applications) {
    const name = investmentNameFromDescription(transaction.description);
    const key = normalizeText(name);
    if (!key) continue;
    const current = grouped.get(key);
    if (current) {
      current.amount += Number(transaction.amount);
      continue;
    }
    grouped.set(key, {
      name,
      amount: Number(transaction.amount),
      userId: transaction.user_id,
      accountId: transaction.account_id,
      type: investmentTypeFromDescription(transaction.description),
    });
  }

  const namesMatch = (left: string, right: string) =>
    Boolean(left && right && (left.includes(right) || right.includes(left)));

  const created: Investment[] = [];
  const remaining = [...investments];
  for (const item of grouped.values()) {
    const key = normalizeText(item.name);
    const syntheticId = `bank-tx:${key.replace(/\s+/g, "-").slice(0, 80)}`;
    const realMatch = remaining.find(
      (row) =>
        !row.pluggy_investment_id?.startsWith("bank-tx:") &&
        namesMatch(normalizeText(row.name), key),
    );
    if (realMatch) {
      const syntheticIndex = remaining.findIndex((row) => row.pluggy_investment_id === syntheticId);
      if (syntheticIndex >= 0) remaining.splice(syntheticIndex, 1);
      await supabase.from("investments").delete().eq("pluggy_investment_id", syntheticId);
      continue;
    }
    const account = accounts.find((row) => row.id === item.accountId);
    const bank = inferInstitutionName([account?.name, item.name], "");
    const displayName = withInstitutionPrefix(item.name, bank || null);
    const { data: row, error } = await supabase
      .from("investments")
      .upsert(
        {
          user_id: item.userId,
          name: displayName,
          amount: item.amount,
          type: item.type,
          amount_original: item.amount,
          bank_connection_id: account?.bank_connection_id ?? null,
          source: "pluggy",
          pluggy_investment_id: syntheticId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "pluggy_investment_id" },
      )
      .select("*")
      .single();
    if (error) {
      console.error("Erro ao registrar investimento a partir do extrato:", error);
      const { data: existing } = await supabase
        .from("investments")
        .select("*")
        .eq("pluggy_investment_id", syntheticId)
        .maybeSingle();
      if (existing) {
        const index = remaining.findIndex((current) => current.id === existing.id);
        if (index >= 0) remaining[index] = existing as Investment;
        else created.push(existing as Investment);
      }
      continue;
    }
    if (row) {
      const index = remaining.findIndex((current) => current.id === row.id);
      if (index >= 0) remaining[index] = row as Investment;
      else created.push(row as Investment);
    }
  }

  return [...remaining, ...created];
}
