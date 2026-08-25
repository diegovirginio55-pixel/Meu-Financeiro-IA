import type { SupabaseClient } from "@supabase/supabase-js";
import { pluggyApi, pluggyInvestmentAmount, type PluggyAccount, type PluggyInvestment } from "./client";
import {
  bankFromLabel,
  inferInstitutionName,
  institutionForAccount,
  isGenericConnectorName,
  singleInstitutionFromAccounts,
  withInstitutionPrefix,
} from "./institution";

const TRANSACTIONS_LOOKBACK_DAYS = 90;

const CATEGORY_MAP: Record<string, string> = {
  restaurants: "Alimentação",
  "food and drink": "Alimentação",
  groceries: "Alimentação",
  transport: "Transporte",
  transportation: "Transporte",
  "auto & transport": "Transporte",
  housing: "Moradia",
  rent: "Moradia",
  utilities: "Moradia",
  education: "Educação",
  health: "Saúde",
  healthcare: "Saúde",
  pharmacy: "Saúde",
  entertainment: "Lazer",
  leisure: "Lazer",
  subscriptions: "Assinaturas",
  streaming: "Assinaturas",
  shopping: "Compras",
  investments: "Investimentos",
  loans: "Dívidas",
  "credit card payment": "Dívidas",
  salary: "Salário",
  income: "Salário",
};

function mapCategory(pluggyCategory: string | null | undefined, isCredit: boolean): string {
  if (pluggyCategory) {
    const mapped = CATEGORY_MAP[pluggyCategory.toLowerCase()];
    if (mapped) return mapped;
  }
  return isCredit ? "Salário" : "Outros";
}

function toDateOnly(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

async function syncTransactionsForAccount(
  supabase: SupabaseClient,
  userId: string,
  pluggyAccountId: string,
  accountId: string | null,
  cardId: string | null,
) {
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - TRANSACTIONS_LOOKBACK_DAYS);

  const transactions = await pluggyApi.fetchAllTransactions(pluggyAccountId, toDateOnly(dateFrom));

  if (transactions.length === 0) return;

  const rows = transactions.map((t) => ({
    user_id: userId,
    description: t.description || "Transação importada",
    amount: Math.abs(t.amount),
    type: t.type === "CREDIT" ? "entrada" : "saida",
    category: mapCategory(t.category, t.type === "CREDIT"),
    date: toDateOnly(t.date),
    account_id: accountId,
    card_id: cardId,
    pluggy_transaction_id: t.id,
    source: "pluggy" as const,
  }));

  await supabase.from("transactions").upsert(rows, { onConflict: "pluggy_transaction_id" });
}

const INVESTMENT_TYPE_LABELS: Record<string, string> = {
  FIXED_INCOME: "Renda Fixa",
  SECURITY: "Previdência",
  MUTUAL_FUND: "Fundo",
  EQUITY: "Renda variável",
  ETF: "ETF",
  COE: "COE",
  OTHER: "Investimento",
  CDB: "CDB",
  LCI: "LCI",
  LCA: "LCA",
  LC: "LC",
  LF: "LF",
  TREASURY: "Tesouro",
  CRI: "CRI",
  CRA: "CRA",
  DEBENTURES: "Debênture",
  CORPORATE_DEBT: "Debênture",
};

function investmentLabel(type?: string, subtype?: string | null, name?: string | null) {
  const haystack = `${name ?? ""} ${subtype ?? ""} ${type ?? ""}`.toUpperCase();
  if (haystack.includes("LCI")) return "LCI";
  if (haystack.includes("LCA")) return "LCA";
  if (/\bCDB\b/.test(haystack)) return "CDB";
  if (haystack.includes("TESOURO")) return "Tesouro";
  if (subtype && INVESTMENT_TYPE_LABELS[subtype]) return INVESTMENT_TYPE_LABELS[subtype];
  if (type && INVESTMENT_TYPE_LABELS[type]) return INVESTMENT_TYPE_LABELS[type];
  return type || "Investimento";
}

function isInvestmentLikeAccount(account: PluggyAccount) {
  if (account.type === "INVESTMENT") return true;
  const haystack = `${account.name ?? ""} ${account.marketingName ?? ""} ${account.subtype ?? ""}`;
  return /\b(lci|lca|cdb|cri|cra|tesouro|deb[eê]nture|renda\s*fixa)\b/i.test(haystack);
}

function accountTypeLabel(subtype?: string) {
  if (subtype === "SAVINGS_ACCOUNT") return "poupanca";
  return "corrente";
}

function pluggyAccountName(account: { name?: string; marketingName?: string | null; number?: string | null }) {
  const raw = account.marketingName || account.name || "Conta";
  const cleaned = raw
    .replace(/\bCP\b/gi, " ")
    .replace(/conta\s*principal/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const base = cleaned || "Conta";
  const digits = account.number?.replace(/\D/g, "") ?? "";
  const last4 = digits.length >= 4 ? digits.slice(-4) : null;
  if (last4 && !base.includes(last4)) return `${base} • ${last4}`;
  return base;
}

function monthlyRate(inv: {
  lastMonthRate?: number | null;
  annualRate?: number | null;
  fixedAnnualRate?: number | null;
}): number | null {
  if (inv.lastMonthRate != null && Number(inv.lastMonthRate) !== 0) return Number(inv.lastMonthRate);
  if (inv.annualRate != null && Number(inv.annualRate) !== 0) return Number(inv.annualRate) / 12;
  if (inv.fixedAnnualRate != null && Number(inv.fixedAnnualRate) !== 0) return Number(inv.fixedAnnualRate) / 12;
  return null;
}

function investmentInstitution(
  inv: {
    name?: string;
    issuer?: string | null;
    issuerCNPJ?: string | null;
    code?: string | null;
    number?: string | null;
    institution?: { name?: string | null; number?: string | null; cnpj?: string | null } | null;
  },
  connectorName: string,
  accountsFallback: string | null,
  itemFallback: string,
) {
  const inferred = inferInstitutionName(
    [
      inv.institution?.name,
      inv.issuer,
      inv.issuerCNPJ,
      inv.institution?.cnpj,
      inv.name,
      inv.institution?.number,
      inv.code,
      inv.number,
    ],
    "",
  );
  if (inferred) return inferred;
  if (isGenericConnectorName(connectorName)) return "";
  return accountsFallback ?? itemFallback;
}

export async function syncBankConnection(
  supabase: SupabaseClient,
  userId: string,
  bankConnectionId: string,
  pluggyItemId: string,
) {
  const item = await pluggyApi.waitForItemIdle(pluggyItemId);
  const { results: accounts } = await pluggyApi.fetchAccounts(pluggyItemId);
  const onlyBank = singleInstitutionFromAccounts(accounts);

  const institutionName = inferInstitutionName(
    [
      ...accounts.map((a) => a.marketingName),
      ...accounts.map((a) => a.name),
      ...accounts.map((a) => a.bankData?.transferNumber),
    ],
    isGenericConnectorName(item.connector.name) ? "Banco conectado" : item.connector.name,
  );

  for (const account of accounts) {
    const institution = institutionForAccount(account, institutionName);
    const rawName = pluggyAccountName(account);

    if (account.type === "BANK" && !isInvestmentLikeAccount(account)) {
      const { data: accountRow } = await supabase
        .from("accounts")
        .upsert(
          {
            user_id: userId,
            name: withInstitutionPrefix(rawName, institution),
            type: accountTypeLabel(account.subtype),
            balance: account.balance,
            pluggy_account_id: account.id,
            bank_connection_id: bankConnectionId,
            source: "pluggy",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "pluggy_account_id" },
        )
        .select("id")
        .single();

      await syncTransactionsForAccount(supabase, userId, account.id, accountRow?.id ?? null, null);
    } else if (account.type === "CREDIT") {
      const credit = account.creditData;
      const { data: cardRow } = await supabase
        .from("cards")
        .upsert(
          {
            user_id: userId,
            name: withInstitutionPrefix(rawName, institution),
            credit_limit: credit?.creditLimit ?? null,
            closing_day: credit?.balanceCloseDate ? new Date(credit.balanceCloseDate).getDate() : null,
            due_day: credit?.balanceDueDate ? new Date(credit.balanceDueDate).getDate() : null,
            current_invoice: account.balance,
            pluggy_account_id: account.id,
            bank_connection_id: bankConnectionId,
            source: "pluggy",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "pluggy_account_id" },
        )
        .select("id")
        .single();

      await syncTransactionsForAccount(supabase, userId, account.id, null, cardRow?.id ?? null);
    }
  }

  try {
    const connectorBank = bankFromLabel(item.connector.name);
    let { results: investments } = await pluggyApi.fetchInvestments(pluggyItemId);
    if (investments.length === 0 && item.status === "UPDATING") {
      await new Promise((resolve) => setTimeout(resolve, 8000));
      investments = (await pluggyApi.fetchInvestments(pluggyItemId)).results;
    }

    const syntheticIds = new Set<string>();
    const fromAccounts: PluggyInvestment[] = accounts.filter(isInvestmentLikeAccount).map((account) => {
      syntheticIds.add(account.id);
      const label = `${account.marketingName || account.name || "Investimento"}`;
      return {
        id: account.id,
        name: label,
        type: "FIXED_INCOME",
        subtype: investmentLabel("FIXED_INCOME", null, label),
        balance: account.balance,
        amount: account.balance,
        institution: { name: institutionForAccount(account, institutionName) },
        status: "ACTIVE",
      };
    });

    const merged = [...investments];
    fromAccounts.forEach((candidate) => {
      const amount = pluggyInvestmentAmount(candidate);
      const already = merged.some((inv) => Math.abs(pluggyInvestmentAmount(inv) - amount) < 1 && amount !== 0);
      if (!already) merged.push(candidate);
    });

    const active = merged
      .filter((inv) => inv.status !== "TOTAL_WITHDRAWAL")
      .filter((inv) => pluggyInvestmentAmount(inv) !== 0 || merged.length === 1);
    if (item.statusDetail?.investments && item.statusDetail.investments.isUpdated === false) {
      console.warn("Pluggy não atualizou investimentos neste sync:", item.statusDetail.investments);
    }

    if (active.length > 0) {
      const rows = active.map((inv) => {
        const bank = investmentInstitution(inv, item.connector.name, connectorBank ?? onlyBank, institutionName);
        const amount = pluggyInvestmentAmount(inv);
        const rate = monthlyRate(inv);
        return {
          user_id: userId,
          name: withInstitutionPrefix(inv.name || "Investimento", bank),
          amount,
          type: investmentLabel(inv.type, inv.subtype, inv.name),
          amount_profit: inv.amountProfit == null ? null : Number(inv.amountProfit),
          amount_original: inv.amountOriginal == null ? null : Number(inv.amountOriginal),
          last_month_rate: rate == null ? null : Number(rate),
          pluggy_investment_id: inv.id,
          bank_connection_id: bankConnectionId,
          source: "pluggy" as const,
          updated_at: new Date().toISOString(),
        };
      });
      const { error } = await supabase
        .from("investments")
        .upsert(rows, { onConflict: "pluggy_investment_id" });
      if (error) throw error;

      const { data: localRows } = await supabase
        .from("investments")
        .select("id, pluggy_investment_id")
        .eq("bank_connection_id", bankConnectionId);
      const idByPluggy = new Map(
        (localRows ?? []).map((row) => [row.pluggy_investment_id as string, row.id as string]),
      );
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

      const snapshots = active.flatMap((inv) => {
        const localId = idByPluggy.get(inv.id);
        if (!localId) return [];
        return [
          {
            user_id: userId,
            investment_id: localId,
            bank_connection_id: bankConnectionId,
            snapshot_date: today,
            amount: pluggyInvestmentAmount(inv),
            amount_profit: inv.amountProfit == null ? null : Number(inv.amountProfit),
          },
        ];
      });
      if (snapshots.length > 0) {
        const { error: snapshotError } = await supabase
          .from("investment_snapshots")
          .upsert(snapshots, { onConflict: "investment_id,snapshot_date" });
        if (snapshotError) console.error("Erro ao gravar snapshot de investimentos:", snapshotError);
      }

      for (const inv of active) {
        if (syntheticIds.has(inv.id)) continue;
        const localId = idByPluggy.get(inv.id);
        if (!localId) continue;
        try {
          const txs = await pluggyApi.fetchInvestmentTransactions(inv.id);
          if (txs.length === 0) continue;
          const txRows = txs.map((transaction) => {
            const raw = Number(transaction.amount ?? 0);
            const type = transaction.type || "OTHER";
            const signed =
              type === "INTEREST"
                ? Math.abs(raw)
                : type === "SELL" || type === "TAX"
                  ? -Math.abs(raw)
                  : type === "BUY"
                    ? Math.abs(raw)
                    : transaction.movementType === "DEBIT"
                      ? -Math.abs(raw)
                      : raw;
            return {
              user_id: userId,
              investment_id: localId,
              bank_connection_id: bankConnectionId,
              pluggy_transaction_id: transaction.id,
              type,
              amount: signed,
              date: toDateOnly(transaction.date),
              description: transaction.description,
            };
          });
          await supabase.from("investment_transactions").upsert(txRows, {
            onConflict: "pluggy_transaction_id",
          });
        } catch (txError) {
          console.error("Erro ao importar movimentações do investimento:", txError);
        }
      }
    }

    const withdrawnIds = investments
      .filter((inv) => inv.status === "TOTAL_WITHDRAWAL")
      .map((inv) => inv.id);
    if (withdrawnIds.length > 0) {
      const { error: cleanupError } = await supabase
        .from("investments")
        .delete()
        .eq("bank_connection_id", bankConnectionId)
        .eq("source", "pluggy")
        .in("pluggy_investment_id", withdrawnIds);
      if (cleanupError) {
        console.error("Erro ao limpar investimentos encerrados da Pluggy:", cleanupError);
      }
    }
  } catch (error) {
    console.error("Erro ao importar investimentos da Pluggy:", error);
  }

  await supabase
    .from("bank_connections")
    .update({
      institution_name: institutionName,
      institution_image_url: item.connector.imageUrl ?? null,
      status: item.status,
      status_detail: item.statusDetail ? JSON.stringify(item.statusDetail) : null,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", bankConnectionId);
}
