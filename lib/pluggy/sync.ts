import type { SupabaseClient } from "@supabase/supabase-js";
import { pluggyApi } from "./client";
import {
  bankFromTransferNumber,
  inferInstitutionName,
  isGenericConnectorName,
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
};

function investmentLabel(type?: string, subtype?: string | null) {
  if (subtype && INVESTMENT_TYPE_LABELS[subtype]) return INVESTMENT_TYPE_LABELS[subtype];
  if (type && INVESTMENT_TYPE_LABELS[type]) return INVESTMENT_TYPE_LABELS[type];
  return type || "Investimento";
}

function accountTypeLabel(subtype?: string) {
  if (subtype === "SAVINGS_ACCOUNT") return "poupanca";
  return "corrente";
}

function pluggyAccountName(account: { name?: string; marketingName?: string | null; number?: string | null }) {
  const base = account.marketingName || account.name || "Conta";
  const digits = account.number?.replace(/\D/g, "") ?? "";
  const last4 = digits.length >= 4 ? digits.slice(-4) : null;
  if (last4 && !base.includes(last4)) return `${base} • ${last4}`;
  return base;
}

/**
 * Busca contas e extratos mais recentes da Pluggy para uma conexão bancária
 * e grava/atualiza os dados nas tabelas accounts/cards/transactions/investments.
 * Só leitura do lado do banco — nenhuma movimentação é feita.
 */
export async function syncBankConnection(
  supabase: SupabaseClient,
  userId: string,
  bankConnectionId: string,
  pluggyItemId: string,
) {
  const item = await pluggyApi.fetchItem(pluggyItemId);
  const { results: accounts } = await pluggyApi.fetchAccounts(pluggyItemId);

  const institutionName = inferInstitutionName(
    [
      ...accounts.map((a) => a.marketingName),
      ...accounts.map((a) => a.name),
      ...accounts.map((a) => a.bankData?.transferNumber),
    ],
    isGenericConnectorName(item.connector.name) ? "Banco conectado" : item.connector.name,
  );

  for (const account of accounts) {
    const fromCompe = bankFromTransferNumber(account.bankData?.transferNumber);
    const institution = fromCompe ?? institutionName;
    const rawName = pluggyAccountName(account);

    if (account.type === "BANK") {
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
    const { results: investments } = await pluggyApi.fetchInvestments(pluggyItemId);
    const active = investments.filter((inv) => inv.status !== "TOTAL_WITHDRAWAL");
    const activeIds = active.map((inv) => inv.id);

    if (active.length > 0) {
      const rows = active.map((inv) => ({
        user_id: userId,
        name: withInstitutionPrefix(inv.name || "Investimento", institutionName),
        amount: Number(inv.balance ?? inv.amount ?? 0),
        type: investmentLabel(inv.type, inv.subtype),
        amount_profit: inv.amountProfit == null ? null : Number(inv.amountProfit),
        amount_original: inv.amountOriginal == null ? null : Number(inv.amountOriginal),
        last_month_rate: inv.lastMonthRate == null ? null : Number(inv.lastMonthRate),
        pluggy_investment_id: inv.id,
        bank_connection_id: bankConnectionId,
        source: "pluggy" as const,
        updated_at: new Date().toISOString(),
      }));
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
            amount: Number(inv.balance ?? inv.amount ?? 0),
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

    let staleQuery = supabase
      .from("investments")
      .delete()
      .eq("bank_connection_id", bankConnectionId)
      .eq("source", "pluggy");
    if (activeIds.length > 0) {
      staleQuery = staleQuery.not("pluggy_investment_id", "in", `(${activeIds.join(",")})`);
    }
    const { error: cleanupError } = await staleQuery;
    if (cleanupError) {
      console.error("Erro ao limpar investimentos antigos da Pluggy:", cleanupError);
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
