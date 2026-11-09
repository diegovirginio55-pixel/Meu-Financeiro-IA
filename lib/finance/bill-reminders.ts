import type { SupabaseClient } from "@supabase/supabase-js";
import type { Card, Debt, RecurringItem } from "./types";
import type { AlertCandidate } from "./alert-checks";
import { daysAgoKey, daysAheadKey, nextMonthlyOccurrenceKey, saoPauloTodayKey } from "./fluxo";
import { formatCurrency } from "./format";
import { isMissingSchemaError } from "@/lib/supabase/schema-compat";

export type BillKind = "recurring" | "debt" | "card";

export type BillRef = { kind: BillKind; id: string; dueDate: string };

export type BillReminder = AlertCandidate & { bill: BillRef };

export function billKey(ref: BillRef): string {
  return `${ref.kind}:${ref.id}:${ref.dueDate}`;
}

/**
 * Lembretes de contas a pagar (núcleo puro, sem banco):
 * - recorrências de saída (aluguel, faculdade...) e dívidas: na véspera e no dia;
 * - fatura de cartão: no dia (3 dias antes já existe o alerta "Fatura chegando").
 * Contas marcadas como pagas ("Já paguei") não são lembradas de novo.
 */
export function computeBillReminders({
  recurring,
  debts,
  cards,
  paidKeys,
  now = new Date(),
}: {
  recurring: RecurringItem[];
  debts: Debt[];
  cards: Card[];
  paidKeys: Set<string>;
  now?: Date;
}): BillReminder[] {
  const today = saoPauloTodayKey(now);
  const tomorrow = daysAheadKey(1, now);
  const reminders: BillReminder[] = [];

  function remind(bill: BillRef, description: string, amount: number) {
    if (bill.dueDate !== today && bill.dueDate !== tomorrow) return;
    if (paidKeys.has(billKey(bill))) return;
    const isToday = bill.dueDate === today;
    reminders.push({
      kind: "bill_due",
      refKey: `${billKey(bill)}:${isToday ? "hoje" : "vespera"}`,
      title: isToday ? "Conta vence hoje 📅" : "Conta vence amanhã 📅",
      body: `${description} · ${formatCurrency(amount)}`,
      url: "/mes",
      bill,
    });
  }

  for (const item of recurring) {
    if (!item.active || item.type !== "saida") continue;
    const dueDate = nextMonthlyOccurrenceKey(Math.max(1, item.day_of_month), today);
    remind({ kind: "recurring", id: item.id, dueDate }, item.description, Number(item.amount));
  }

  for (const debt of debts) {
    if (debt.paid || !debt.due_date) continue;
    const description = debt.person ? `${debt.description} (${debt.person})` : debt.description;
    remind({ kind: "debt", id: debt.id, dueDate: debt.due_date }, description, Number(debt.amount));
  }

  for (const card of cards) {
    const invoice = Number(card.current_invoice) || 0;
    if (!card.due_day || invoice <= 0) continue;
    const dueDate = nextMonthlyOccurrenceKey(Math.max(1, card.due_day), today);
    if (dueDate !== today) continue;
    remind({ kind: "card", id: card.id, dueDate }, `Fatura ${card.name}`, invoice);
  }

  return reminders;
}

/** Contas já marcadas como pagas perto de hoje (vazio se a migration 0012 ainda não rodou). */
export async function paidBillKeys(supabase: SupabaseClient, userId: string, now = new Date()): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("bill_payments")
    .select("kind, ref_id, due_date")
    .eq("user_id", userId)
    .gte("due_date", daysAgoKey(7, now))
    .lte("due_date", daysAheadKey(7, now));
  if (error) {
    if (!isMissingSchemaError(error)) console.error("Erro ao ler contas pagas:", error);
    return new Set();
  }
  return new Set(
    (data ?? []).map((row) => billKey({ kind: row.kind as BillKind, id: row.ref_id as string, dueDate: row.due_date as string })),
  );
}

/** Busca os dados do usuário e calcula os lembretes (usado pelo cron). */
export async function computeBillRemindersForUser(
  supabase: SupabaseClient,
  userId: string,
  now = new Date(),
): Promise<{ reminders: BillReminder[]; paidKeys: Set<string> }> {
  const [recurringRes, debtsRes, cardsRes, paidKeys] = await Promise.all([
    supabase.from("recurring_items").select("*").eq("user_id", userId).eq("active", true),
    supabase.from("debts").select("*").eq("user_id", userId).eq("paid", false),
    supabase.from("cards").select("*").eq("user_id", userId),
    paidBillKeys(supabase, userId, now),
  ]);
  const reminders = computeBillReminders({
    recurring: (recurringRes.data ?? []) as RecurringItem[],
    debts: (debtsRes.data ?? []) as Debt[],
    cards: (cardsRes.data ?? []) as Card[],
    paidKeys,
    now,
  });
  return { reminders, paidKeys };
}

/**
 * "Já paguei": registra o pagamento daquele vencimento, marca a dívida como
 * paga, zera a fatura de cartão manual (cartão do banco atualiza sozinho) e
 * marca o lembrete como lido na central de notificações. Usa o cliente
 * admin (chamado a partir do botão da notificação, com token assinado), por
 * isso tudo é filtrado pelo user_id do token.
 */
export async function markBillPaid(
  supabase: SupabaseClient,
  userId: string,
  bill: BillRef,
): Promise<{ ok: true; description: string } | { ok: false; error: string; status: number }> {
  let description = "Conta";

  if (bill.kind === "debt") {
    const { data, error } = await supabase
      .from("debts")
      .update({ paid: true })
      .eq("id", bill.id)
      .eq("user_id", userId)
      .select("description")
      .maybeSingle();
    if (error) return { ok: false, error: "Não foi possível marcar a dívida como paga.", status: 500 };
    if (!data) return { ok: false, error: "Dívida não encontrada.", status: 404 };
    description = data.description as string;
  } else if (bill.kind === "card") {
    const { data: card } = await supabase
      .from("cards")
      .select("name, source")
      .eq("id", bill.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!card) return { ok: false, error: "Cartão não encontrado.", status: 404 };
    description = `Fatura ${card.name}`;
    if (card.source !== "pluggy") {
      await supabase
        .from("cards")
        .update({ current_invoice: 0, updated_at: new Date().toISOString() })
        .eq("id", bill.id)
        .eq("user_id", userId);
    }
  } else {
    const { data: item } = await supabase
      .from("recurring_items")
      .select("description")
      .eq("id", bill.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!item) return { ok: false, error: "Conta não encontrada.", status: 404 };
    description = item.description as string;
  }

  const { error: paymentError } = await supabase.from("bill_payments").upsert(
    { user_id: userId, kind: bill.kind, ref_id: bill.id, due_date: bill.dueDate },
    { onConflict: "user_id,kind,ref_id,due_date", ignoreDuplicates: true },
  );
  if (paymentError) {
    // Dívida já ficou marcada como paga; para recorrência/fatura a tabela é necessária.
    if (isMissingSchemaError(paymentError) && bill.kind !== "debt") {
      return { ok: false, error: "Falta aplicar a migration 0012 no Supabase.", status: 503 };
    }
    if (!isMissingSchemaError(paymentError)) console.error("Erro ao registrar conta paga:", paymentError);
  }

  // Tira o lembrete (e o "Fatura chegando") de "não lidos" na central.
  const readAt = new Date().toISOString();
  await supabase
    .from("notification_log")
    .update({ read_at: readAt })
    .eq("user_id", userId)
    .eq("kind", "bill_due")
    .like("ref_key", `${billKey(bill)}%`);
  if (bill.kind === "card") {
    await supabase
      .from("notification_log")
      .update({ read_at: readAt })
      .eq("user_id", userId)
      .eq("kind", "card_due")
      .eq("ref_key", `${bill.id}:${bill.dueDate}`);
  }

  return { ok: true, description };
}
