import type { SupabaseClient } from "@supabase/supabase-js";
import { inferInstitutionName, withInstitutionPrefix } from "@/lib/pluggy/institution";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
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

/**
 * Pré-filtro no banco (sem acento, por isso "aplica", "nture", "previd")
 * para não baixar o extrato inteiro; o filtro exato é isInvestmentDescription.
 */
export const INVESTMENT_PREFILTER = [
  "aplica",
  "resgate",
  "renda fixa",
  "lci",
  "lca",
  "lcd",
  "cdb",
  "cri",
  "cra",
  "tesouro",
  "nture",
  "previd",
]
  .map((word) => `description.ilike.*${word}*`)
  .join(",");

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
  userId?: string,
): Promise<Investment[]> {
  const official = investments.filter((row) => isOfficialPluggyId(row.pluggy_investment_id));

  const leftoverSynthetics = investments.filter((row) => {
    if (!row.pluggy_investment_id?.startsWith("bank-tx:")) return false;
    return official.some((other) => investmentNamesMatch(other.name, row.name));
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

  // Sempre filtrado pelo dono: no sync em segundo plano o cliente é admin
  // (ignora RLS) e sem esse filtro lia lançamentos de todos os usuários.
  const { data, error: fetchError } = await fetchAllRows<Transaction>((from, to) => {
    let query = supabase
      .from("transactions")
      .select("id, user_id, description, amount, type, category, account_id, date")
      .in("type", ["saida", "entrada"])
      .or(INVESTMENT_PREFILTER);
    if (userId) query = query.eq("user_id", userId);
    return query.order("date", { ascending: true }).order("id", { ascending: true }).range(from, to);
  });
  // Sem a lista completa não dá para saber o que já foi resgatado: mantém tudo como está.
  if (fetchError) return remaining;

  // Aplicações (saída) somam; qualquer crédito de investimento (entrada)
  // desconta — "Resgate", "Crédito Renda Fixa", "Vencimento"... O Inter
  // escreve o resgate de uma LCD como "Crédito Renda Fixa - Lcd Di Flut Tb
  // Banco De Desenvolvimento De Minas G", sem a palavra "resgate", e com
  // outro nome que a aplicação ("Lcd Bdmg Liquid"): antes o resgate era
  // ignorado e a LCD resgatada continuava somando no patrimônio.
  const applications = data.filter((item) => isInvestmentDescription(item.description));
  if (applications.length === 0) return pruneStaleSynthetics(supabase, remaining, new Set());

  // Só recategoriza o que estava sem categoria definida; se o usuário
  // escolheu outra categoria, ela é mantida.
  const recategorizeIds = applications
    .filter((item) => item.category === "Outros" || item.category === "Salário" || !item.category)
    .map((item) => item.id);
  for (let index = 0; index < recategorizeIds.length; index += 150) {
    await supabase
      .from("transactions")
      .update({ category: "Investimentos" })
      .in("id", recategorizeIds.slice(index, index + 150));
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

  // Agrupa por conta + produto (LCD, LCI, CDB...): aplicação e resgate do
  // mesmo produto na mesma conta se anulam mesmo com descrições diferentes.
  // Sem produto reconhecível (ex.: "Aplicação Fundo X"), agrupa pelo nome.
  const syntheticIds = new Map<string, string>();
  for (const transaction of applications) {
    const name = investmentNameFromDescription(transaction.description);
    const product = investmentProductKey(transaction.description);
    const nameKey = normalizeText(name);
    if (!product && !nameKey) continue;
    const account = transaction.account_id ?? "sem-conta";
    const key = product ? `${account}:${product}` : `${account}:${nameKey}`;
    if (!syntheticIds.has(key)) {
      syntheticIds.set(
        key,
        product
          ? `bank-tx:${product}-${account.slice(0, 8)}`
          : `bank-tx:${nameKey.replace(/\s+/g, "-").slice(0, 80)}`,
      );
    }
    const current = grouped.get(key);
    const signed = transaction.type === "entrada" ? -Number(transaction.amount) : Number(transaction.amount);
    const movement = {
      id: transaction.id,
      date: transaction.date,
      amount: signed,
      description: transaction.description,
    };
    if (current) {
      current.amount += signed;
      current.movements.push(movement);
      // O nome do investimento vem da aplicação (o resgate costuma ter outro texto).
      if (transaction.type === "saida" && current.movements.every((m) => m.amount < 0 || m.id === transaction.id)) {
        current.name = name;
        current.type = investmentTypeFromDescription(transaction.description);
      }
      continue;
    }
    grouped.set(key, {
      name,
      amount: signed,
      userId: transaction.user_id,
      accountId: transaction.account_id,
      type: investmentTypeFromDescription(transaction.description),
      movements: [movement],
    });
  }

  const created: Investment[] = [];
  const producedIds = new Set<string>();
  for (const [groupKey, item] of grouped) {
    const syntheticId = syntheticIds.get(groupKey)!;
    // Só crédito, sem aplicação no período: é resgate de algo que o app não acompanha.
    if (!item.movements.some((movement) => movement.amount > 0)) continue;
    const realMatch = remaining.find(
      (row) =>
        isOfficialPluggyId(row.pluggy_investment_id) && investmentNamesMatch(row.name, item.name),
    );
    const account = accounts.find((row) => row.id === item.accountId);
    if (realMatch) {
      const syntheticIndex = remaining.findIndex((row) => row.pluggy_investment_id === syntheticId);
      if (syntheticIndex >= 0) remaining.splice(syntheticIndex, 1);
      await supabase.from("investments").delete().eq("pluggy_investment_id", syntheticId);
      continue;
    }

    // Tudo resgatado: o investimento acabou (a limpeza no fim remove o registro).
    if (item.amount < 0.01) continue;
    producedIds.add(syntheticId);

    // Já existe um investimento sintético com o mesmo valor: nada mudou desde a
    // última vez, então não vale a pena regravar tudo de novo a cada navegação.
    const existingSynthetic = remaining.find((row) => row.pluggy_investment_id === syntheticId);
    if (existingSynthetic && Math.abs(Number(existingSynthetic.amount) - item.amount) < 0.005) {
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

  return pruneStaleSynthetics(supabase, [...remaining, ...created], producedIds);
}

/**
 * Investimentos "deduzidos do extrato" que não existem mais: totalmente
 * resgatados, cobertos por um investimento oficial da Pluggy ou de um
 * formato antigo de agrupamento. Remove do banco e da lista.
 */
async function pruneStaleSynthetics(
  supabase: SupabaseClient,
  list: Investment[],
  producedIds: Set<string>,
): Promise<Investment[]> {
  const stale = list.filter(
    (row) => row.pluggy_investment_id?.startsWith("bank-tx:") && !producedIds.has(row.pluggy_investment_id),
  );
  if (stale.length === 0) return list;
  const { error } = await supabase
    .from("investments")
    .delete()
    .in(
      "id",
      stale.map((row) => row.id),
    );
  if (error) {
    console.error("Erro ao remover investimentos do extrato já resgatados:", error);
    return list;
  }
  const staleIds = new Set(stale.map((row) => row.id));
  return list.filter((row) => !staleIds.has(row.id));
}

/** Produto de renda fixa na descrição (para casar aplicação e resgate do mesmo produto). */
export function investmentProductKey(description: string): string {
  const text = normalizeText(description);
  if (/\blcd\b/.test(text)) return "lcd";
  if (/\blci\b/.test(text)) return "lci";
  if (/\blca\b/.test(text)) return "lca";
  if (/\bcdb\b/.test(text)) return "cdb";
  if (/\bcri\b/.test(text)) return "cri";
  if (/\bcra\b/.test(text)) return "cra";
  if (/tesouro/.test(text)) return "tesouro";
  if (/debenture/.test(text)) return "debenture";
  if (/previdencia/.test(text)) return "previdencia";
  return "";
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
    type: movement.amount >= 0 ? "BUY" : "SELL",
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
