import { createClient } from "@/lib/supabase/server";
import ContasClient from "@/components/contas/ContasClient";
import { getBankConnectionsWithAssets } from "@/lib/finance/bank-connections";
import { buildMonthBills, billPaymentKey } from "@/lib/finance/month-bills";
import { saoPauloMonthKey, saoPauloTodayKey, shiftMonthKey } from "@/lib/finance/fluxo";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { BillKind } from "@/lib/finance/bill-reminders";
import { installmentsByMonth } from "@/lib/finance/card-installments";
import { loadCardInstallments } from "@/lib/finance/card-installments-store";
import type { Card, Debt, RecurringItem, Transaction } from "@/lib/finance/types";

export const dynamic = "force-dynamic";

function monthBounds(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: `${monthKey}-01`, end: `${monthKey}-${String(lastDay).padStart(2, "0")}` };
}

function shiftDays(key: string, days: number) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Contas do mês: a pagar e a receber, com totais, status e sugestões. ?mes=AAAA-MM */
export default async function ContasPage({ searchParams }: { searchParams: Promise<{ mes?: string | string[] }> }) {
  const supabase = await createClient();
  const params = await searchParams;
  const currentMonth = saoPauloMonthKey();
  const wanted = typeof params.mes === "string" && /^\d{4}-\d{2}$/.test(params.mes) ? params.mes : currentMonth;
  // Só faz sentido olhar perto de hoje (as faturas e o saldo são os de agora).
  const monthKey = wanted < shiftMonthKey(currentMonth, -3) || wanted > shiftMonthKey(currentMonth, 3) ? currentMonth : wanted;
  const { start, end } = monthBounds(monthKey);

  const [recurringRes, debtsRes, cardsRes, paymentsRes, txRes, connections] = await Promise.all([
    supabase.from("recurring_items").select("*").eq("active", true).order("day_of_month"),
    supabase.from("debts").select("*").not("due_date", "is", null),
    supabase.from("cards").select("*"),
    supabase.from("bill_payments").select("kind, ref_id, due_date").gte("due_date", start).lte("due_date", end),
    fetchAllRows<Transaction>((from, to) =>
      supabase
        .from("transactions")
        .select("*")
        .gte("date", shiftDays(start, -7))
        .lte("date", shiftDays(end, 7))
        .order("date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    getBankConnectionsWithAssets(supabase),
  ]);

  const cards = (cardsRes.data ?? []) as Card[];
  const cardInstallments = await loadCardInstallments(cards.map((card) => card.id));
  const installmentsAhead = installmentsByMonth(
    Array.from(cardInstallments.values()).flat(),
    currentMonth,
    6,
  ).filter((month) => month.total > 0);

  const paidKeys = new Set(
    (paymentsRes.data ?? []).map((row) => billPaymentKey(row.kind as BillKind, row.ref_id as string, row.due_date as string)),
  );
  const accountBalance = connections
    .flatMap((connection) => connection.accounts)
    .reduce((sum, account) => sum + Number(account.balance), 0);

  const todayKey = saoPauloTodayKey();
  const summary = buildMonthBills({
    monthKey,
    todayKey,
    recurring: (recurringRes.data ?? []) as RecurringItem[],
    debts: (debtsRes.data ?? []) as Debt[],
    cards,
    paidKeys,
    transactions: txRes.data,
    accountBalance,
    cardInstallments,
  });

  return (
    <ContasClient
      summary={summary}
      accountBalance={accountBalance}
      todayKey={todayKey}
      installmentsAhead={installmentsAhead}
      prevMonth={shiftMonthKey(monthKey, -1) >= shiftMonthKey(currentMonth, -3) ? shiftMonthKey(monthKey, -1) : null}
      nextMonth={shiftMonthKey(monthKey, 1) <= shiftMonthKey(currentMonth, 3) ? shiftMonthKey(monthKey, 1) : null}
    />
  );
}
