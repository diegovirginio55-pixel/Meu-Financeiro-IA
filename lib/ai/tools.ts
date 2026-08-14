import type { SupabaseClient } from "@supabase/supabase-js";
import type { FunctionDeclaration } from "@google/genai";
import { CATEGORIES } from "@/lib/finance/categories";
import { getFinancialSnapshot } from "@/lib/finance/summary";
import type { Account, Card } from "@/lib/finance/types";

/**
 * Definição das ferramentas (function calling) que a IA pode usar
 * para transformar linguagem natural em dados estruturados no Supabase.
 */
export const toolDefinitions: FunctionDeclaration[] = [
  {
    name: "create_transaction",
    description:
      "Registra uma entrada (receita) ou saída (despesa) pontual informada pelo usuário. Use para qualquer gasto ou recebimento que já aconteceu.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Descrição curta, ex: 'Mercado', 'Salário', 'Combustível'" },
        amount: { type: "number", description: "Valor em reais, sempre positivo" },
        type: { type: "string", enum: ["entrada", "saida"] },
        category: { type: "string", enum: CATEGORIES as unknown as string[] },
        date: { type: "string", description: "Data no formato YYYY-MM-DD. Se não informado, usa a data de hoje." },
        account_name: { type: "string", description: "Nome da conta usada, se mencionado. Se não informado, usa a conta principal." },
        card_name: { type: "string", description: "Nome do cartão, se o gasto foi no cartão de crédito (aumenta a fatura em vez do saldo da conta)." },
      },
      required: ["description", "amount", "type", "category"],
    },
  },
  {
    name: "set_account_balance",
    description:
      "Define o saldo atual de uma conta quando o usuário informa quanto tem disponível agora (ex: 'tenho 700 na conta'), sem que isso seja uma transação/movimento.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        account_name: { type: "string", description: "Nome da conta. Se não informado, usa a conta principal." },
        balance: { type: "number" },
      },
      required: ["balance"],
    },
  },
  {
    name: "set_card_invoice",
    description:
      "Define o valor atual da fatura de um cartão de crédito quando o usuário informa isso diretamente (ex: 'minha fatura está 850').",
    parametersJsonSchema: {
      type: "object",
      properties: {
        card_name: { type: "string", description: "Nome do cartão. Se não informado, usa o cartão principal." },
        amount: { type: "number" },
      },
      required: ["amount"],
    },
  },
  {
    name: "create_recurring_item",
    description:
      "Registra uma receita ou despesa fixa/recorrente mensal (ex: salário, aluguel, faculdade, internet, assinaturas).",
    parametersJsonSchema: {
      type: "object",
      properties: {
        description: { type: "string" },
        amount: { type: "number" },
        type: { type: "string", enum: ["entrada", "saida"] },
        category: { type: "string", enum: CATEGORIES as unknown as string[] },
        day_of_month: { type: "number", description: "Dia do mês em que ocorre (1 a 31)." },
      },
      required: ["description", "amount", "type", "category", "day_of_month"],
    },
  },
  {
    name: "create_debt",
    description:
      "Registra uma dívida do usuário com alguém (pessoa) ou uma pendência a pagar (ex: 'devo 500 para meu irmão').",
    parametersJsonSchema: {
      type: "object",
      properties: {
        description: { type: "string" },
        amount: { type: "number" },
        person: { type: "string", description: "Para quem o usuário deve, se aplicável." },
        due_date: { type: "string", description: "Data de vencimento YYYY-MM-DD, se houver." },
      },
      required: ["description", "amount"],
    },
  },
  {
    name: "mark_debt_paid",
    description: "Marca uma dívida existente como paga, a partir da descrição informada pelo usuário.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        description_contains: { type: "string", description: "Trecho da descrição da dívida para localizá-la." },
      },
      required: ["description_contains"],
    },
  },
  {
    name: "get_financial_summary",
    description:
      "Consulta a fotografia financeira atual completa: saldos, faturas, patrimônio, investimentos, dívidas, entradas/despesas do mês, maiores gastos, gastos por categoria e previsão dos próximos 30 dias. Use sempre que precisar responder perguntas sobre a situação financeira do usuário.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "query_transactions",
    description:
      "Busca transações específicas no histórico, com filtros opcionais. Use para responder perguntas como 'quanto gastei com X' ou 'quais foram meus gastos em determinado período'.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        category: { type: "string", enum: CATEGORIES as unknown as string[] },
        type: { type: "string", enum: ["entrada", "saida"] },
        date_from: { type: "string", description: "YYYY-MM-DD" },
        date_to: { type: "string", description: "YYYY-MM-DD" },
        description_contains: { type: "string" },
        limit: { type: "number", description: "Máximo de resultados, padrão 50." },
      },
    },
  },
];

async function resolveAccountId(
  supabase: SupabaseClient,
  accountName?: string,
): Promise<{ id: string | null; account: Account | null }> {
  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at");
  const list = (accounts ?? []) as Account[];
  if (list.length === 0) return { id: null, account: null };

  if (accountName) {
    const match = list.find((a) =>
      a.name.toLowerCase().includes(accountName.toLowerCase()),
    );
    if (match) return { id: match.id, account: match };
  }
  return { id: list[0].id, account: list[0] };
}

async function resolveCardId(
  supabase: SupabaseClient,
  cardName?: string,
): Promise<{ id: string | null; card: Card | null }> {
  const { data: cards } = await supabase
    .from("cards")
    .select("*")
    .order("created_at");
  const list = (cards ?? []) as Card[];
  if (list.length === 0) return { id: null, card: null };

  if (cardName) {
    const match = list.find((c) =>
      c.name.toLowerCase().includes(cardName.toLowerCase()),
    );
    if (match) return { id: match.id, card: match };
  }
  return { id: list[0].id, card: list[0] };
}

/**
 * Executa uma chamada de ferramenta feita pela IA contra o Supabase
 * do usuário autenticado (RLS garante o isolamento dos dados).
 */
export async function executeTool(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "create_transaction": {
      const {
        description,
        amount,
        type,
        category,
        date,
        account_name,
        card_name,
      } = input as {
        description: string;
        amount: number;
        type: "entrada" | "saida";
        category: string;
        date?: string;
        account_name?: string;
        card_name?: string;
      };

      let accountId: string | null = null;
      let cardId: string | null = null;

      if (card_name) {
        const { id, card } = await resolveCardId(supabase, card_name);
        cardId = id;
        if (card) {
          const delta = type === "saida" ? amount : -amount;
          await supabase
            .from("cards")
            .update({ current_invoice: Number(card.current_invoice) + delta, updated_at: new Date().toISOString() })
            .eq("id", card.id);
        }
      } else {
        const { id, account } = await resolveAccountId(supabase, account_name);
        accountId = id;
        if (account) {
          const delta = type === "entrada" ? amount : -amount;
          await supabase
            .from("accounts")
            .update({ balance: Number(account.balance) + delta, updated_at: new Date().toISOString() })
            .eq("id", account.id);
        }
      }

      const { data, error } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          description,
          amount,
          type,
          category,
          date: date ?? new Date().toISOString().slice(0, 10),
          account_id: accountId,
          card_id: cardId,
          source: "chat",
        })
        .select()
        .single();

      if (error) return { success: false, error: error.message };
      return { success: true, transaction: data };
    }

    case "set_account_balance": {
      const { account_name, balance } = input as {
        account_name?: string;
        balance: number;
      };
      const { id, account } = await resolveAccountId(supabase, account_name);
      if (!id) return { success: false, error: "Nenhuma conta encontrada." };
      const { error } = await supabase
        .from("accounts")
        .update({ balance, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) return { success: false, error: error.message };
      return { success: true, account_name: account?.name, balance };
    }

    case "set_card_invoice": {
      const { card_name, amount } = input as {
        card_name?: string;
        amount: number;
      };
      const { id, card } = await resolveCardId(supabase, card_name);
      if (!id) return { success: false, error: "Nenhum cartão encontrado." };
      const { error } = await supabase
        .from("cards")
        .update({ current_invoice: amount, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) return { success: false, error: error.message };
      return { success: true, card_name: card?.name, current_invoice: amount };
    }

    case "create_recurring_item": {
      const { description, amount, type, category, day_of_month } =
        input as {
          description: string;
          amount: number;
          type: "entrada" | "saida";
          category: string;
          day_of_month: number;
        };
      const { data, error } = await supabase
        .from("recurring_items")
        .insert({ user_id: userId, description, amount, type, category, day_of_month })
        .select()
        .single();
      if (error) return { success: false, error: error.message };
      return { success: true, recurring_item: data };
    }

    case "create_debt": {
      const { description, amount, person, due_date } = input as {
        description: string;
        amount: number;
        person?: string;
        due_date?: string;
      };
      const { data, error } = await supabase
        .from("debts")
        .insert({ user_id: userId, description, amount, person, due_date })
        .select()
        .single();
      if (error) return { success: false, error: error.message };
      return { success: true, debt: data };
    }

    case "mark_debt_paid": {
      const { description_contains } = input as {
        description_contains: string;
      };
      const { data: debts } = await supabase
        .from("debts")
        .select("*")
        .ilike("description", `%${description_contains}%`)
        .eq("paid", false);
      if (!debts || debts.length === 0) {
        return { success: false, error: "Nenhuma dívida correspondente encontrada." };
      }
      const target = debts[0];
      const { error } = await supabase
        .from("debts")
        .update({ paid: true })
        .eq("id", target.id);
      if (error) return { success: false, error: error.message };
      return { success: true, debt: target };
    }

    case "get_financial_summary": {
      const snapshot = await getFinancialSnapshot(supabase);
      return snapshot;
    }

    case "query_transactions": {
      const {
        category,
        type,
        date_from,
        date_to,
        description_contains,
        limit,
      } = input as {
        category?: string;
        type?: "entrada" | "saida";
        date_from?: string;
        date_to?: string;
        description_contains?: string;
        limit?: number;
      };

      let query = supabase.from("transactions").select("*");
      if (category) query = query.eq("category", category);
      if (type) query = query.eq("type", type);
      if (date_from) query = query.gte("date", date_from);
      if (date_to) query = query.lte("date", date_to);
      if (description_contains)
        query = query.ilike("description", `%${description_contains}%`);
      query = query.order("date", { ascending: false }).limit(limit ?? 50);

      const { data, error } = await query;
      if (error) return { success: false, error: error.message };
      const total = (data ?? []).reduce((s, t) => s + Number(t.amount), 0);
      return { success: true, count: data?.length ?? 0, total, transactions: data };
    }

    default:
      return { success: false, error: `Ferramenta desconhecida: ${name}` };
  }
}
