import type { SupabaseClient } from "@supabase/supabase-js";
import { pluggyApi } from "./client";

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

/**
 * Busca contas e extratos mais recentes da Pluggy para uma conexão bancária
 * e grava/atualiza os dados nas tabelas accounts/cards/transactions.
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

  for (const account of accounts) {
    if (account.type === "BANK") {
      const { data: accountRow } = await supabase
        .from("accounts")
        .upsert(
          {
            user_id: userId,
            name: account.name || item.connector.name,
            type: "corrente",
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
            name: account.name || item.connector.name,
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

  await supabase
    .from("bank_connections")
    .update({
      institution_name: item.connector.name,
      institution_image_url: item.connector.imageUrl ?? null,
      status: item.status,
      status_detail: item.statusDetail ? JSON.stringify(item.statusDetail) : null,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", bankConnectionId);
}
