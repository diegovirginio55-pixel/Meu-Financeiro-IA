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

export function investmentNamesMatch(left: string, right: string): boolean {
  const a = normalizeText(left);
  const b = normalizeText(right);
  if (a && b && (a.includes(b) || b.includes(a))) return true;
  const product = (text: string) => {
    if (/\blcd\b/.test(text)) return "lcd";
    if (/\blci\b/.test(text)) return "lci";
    if (/\blca\b/.test(text)) return "lca";
    if (/\bcdb\b/.test(text)) return "cdb";
    if (/tesouro/.test(text)) return "tesouro";
    return "";
  };
  const pa = product(a);
  const pb = product(b);
  return Boolean(pa && pa === pb);
}

function isOfficialPluggyId(id?: string | null) {
  return Boolean(id && !id.startsWith("bank-tx:"));
}

export async function promoteInvestmentsFromTransactions(
  supabase: SupabaseClient,
  accounts: Account[],
  investments: Investment[],
): Promise<Investment[]> {
  const officialConnectionIds = new Set(
    investments
      .filter((row) => isOfficialPluggyId(row.pluggy_investment_id))
      .map((row) => row.bank_connection_id)
      .filter((id): id is string => Boolean(id)),
  );

  const leftoverSynthetics = investments.filter((row) => {
    if (!row.pluggy_investment_id?.startsWith("bank-tx:")) return false;
    if (!row.bank_connection_id) return officialConnectionIds.size > 0;
    return officialConnectionIds.has(row.bank_connection_id);
  });
  if (leftoverSynthetics.length > 0) {
    await supabase.from("investments").delete().in(
      "id",
      leftoverSynthetics.map((row) => row.id),
    );
  }
  const remaining = investments.filter(
    (row) => !leftoverSynthetics.some((item) => item.id === row.id),
  );

  const { data } = await supabase
    .from("transactions")
    .select("id, user_id, description, amount, type, category, account_id, date")
    .eq("type", "saida");
  const applications = ((data ?? []) as Transaction[]).filter((item) =>
    isInvestmentDescription(item.description),
  );
  if (applications.length === 0) return remaining;

  const recategorizeIds = applications
    .filter((item) => item.category !== "Investimentos")
    .map((item) => item.id);
  if (recategorizeIds.length > 0) {
    await supabase.from("transactions").update({ category: "Investimentos" }).in("id", recategorizeIds);
  }

  const grouped = new Map<
    string,
    {
      name: string;
      amount: number;
      userId: string;
      accountId: string | null;
      type: string;
      movements: { id: string; date: string; amount: number; description: string }[];
    }
  >();

  for (const transaction of applications) {
    const name = investmentNameFromDescription(transaction.description);
    const key = normalizeText(name);
    if (!key) continue;
    const current = grouped.get(key);
    const movement = {
      id: transaction.id,
      date: transaction.date,
      amount: Number(transaction.amount),
      description: transaction.description,
    };
    if (current) {
      current.amount += Number(transaction.amount);
      current.movements.push(movement);
      continue;
    }
    grouped.set(key, {
      name,
      amount: Number(transaction.amount),
      userId: transaction.user_id,
      accountId: transaction.account_id,
      type: investmentTypeFromDescription(transaction.description),
      movements: [movement],
    });
  }

  const namesMatch = (left: string, right: string) =>
    Boolean(left && right && (left.includes(right) || right.includes(left)));

  const created: Investment[] = [];
  for (const item of grouped.values()) {
    const key = normalizeText(item.name);
    const syntheticId = `bank-tx:${key.replace(/\s+/g, "-").slice(0, 80)}`;
    const realMatch = remaining.find(
      (row) =>
        isOfficialPluggyId(row.pluggy_investment_id) &&
        namesMatch(normalizeText(row.name), key),
    );
    const account = accounts.find((row) => row.id === item.accountId);
    const connectionHasOfficial =
      Boolean(account?.bank_connection_id && officialConnectionIds.has(account.bank_connection_id));
    if (realMatch || connectionHasOfficial) {
      const syntheticIndex = remaining.findIndex((row) => row.pluggy_investment_id === syntheticId);
      if (syntheticIndex >= 0) remaining.splice(syntheticIndex, 1);
      await supabase.from("investments").delete().eq("pluggy_investment_id", syntheticId);
      continue;
    }
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
        await syncSyntheticInvestmentHistory(supabase, existing as Investment, item, account);
      }
      continue;
    }
    if (row) {
      const index = remaining.findIndex((current) => current.id === row.id);
      if (index >= 0) remaining[index] = row as Investment;
      else created.push(row as Investment);
      await syncSyntheticInvestmentHistory(supabase, row as Investment, item, account);
    }
  }

  return [...remaining, ...created];
}

async function syncSyntheticInvestmentHistory(
  supabase: SupabaseClient,
  investment: Investment,
  group: {
    userId: string;
    amount: number;
    accountId: string | null;
    movements: { id: string; date: string; amount: number; description: string }[];
  },
  account: Account | undefined,
) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const bankConnectionId = account?.bank_connection_id ?? investment.bank_connection_id ?? null;
  const byDate = new Map<string, number>();
  for (const movement of group.movements) {
    byDate.set(movement.date, (byDate.get(movement.date) ?? 0) + movement.amount);
  }

  let cumulative = 0;
  const snapshots = [...byDate.keys()].sort().map((date) => {
    cumulative += byDate.get(date) ?? 0;
    return {
      user_id: group.userId,
      investment_id: investment.id,
      bank_connection_id: bankConnectionId,
      snapshot_date: date,
      amount: cumulative,
      amount_profit: null,
    };
  });
  if (!byDate.has(today)) {
    snapshots.push({
      user_id: group.userId,
      investment_id: investment.id,
      bank_connection_id: bankConnectionId,
      snapshot_date: today,
      amount: group.amount,
      amount_profit: null,
    });
  }

  const { error: snapshotError } = await supabase
    .from("investment_snapshots")
    .upsert(snapshots, { onConflict: "investment_id,snapshot_date" });
  if (snapshotError) {
    console.error("Erro ao gravar snapshot do investimento do extrato:", snapshotError);
  }

  const txRows = group.movements.map((movement) => ({
    user_id: group.userId,
    investment_id: investment.id,
    bank_connection_id: bankConnectionId,
    pluggy_transaction_id: `bank-tx:${movement.id}`,
    type: "BUY",
    amount: movement.amount,
    date: movement.date,
    description: movement.description,
  }));
  const { error: txError } = await supabase
    .from("investment_transactions")
    .upsert(txRows, { onConflict: "pluggy_transaction_id" });
  if (txError) {
    console.error("Erro ao gravar aplicação do extrato nos gráficos:", txError);
  }
}
