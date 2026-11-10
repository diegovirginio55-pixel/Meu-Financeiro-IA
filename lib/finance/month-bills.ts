import type { Card, Debt, RecurringItem, Transaction } from "./types";
import type { BillKind } from "./bill-reminders";
import { clampDayToMonth } from "./fluxo";
import { isCardBillPayment } from "./categories";
import { formatCurrency } from "./format";

/**
 * "Contas do mês" (núcleo puro, sem banco): o que há para pagar e receber
 * no mês, o que já foi pago/recebido, quanto sobra e sugestões.
 *
 * Fontes: recorrências (todo mês: água, luz, salário…), dívidas com data
 * (contas de uma vez só) e faturas dos cartões (dos bancos ou manuais).
 * "Pago/recebido" vem de bill_payments (o mesmo "Já paguei" da notificação)
 * ou, nas dívidas, do campo paid.
 */
export type BillSide = "pagar" | "receber";
export type BillStatus = "feito" | "atrasado" | "hoje" | "proximo" | "futuro";

export type MonthBill = {
  kind: BillKind;
  id: string;
  side: BillSide;
  description: string;
  amount: number;
  category: string;
  dueDate: string;
  /** Repete todo mês (recorrência / fatura) ou é de uma vez só (dívida). */
  recurring: boolean;
  /** Fatura de cartão do banco: valor vem do banco, não dá para editar aqui. */
  fromBank: boolean;
  done: boolean;
  status: BillStatus;
  /** Lançamento do extrato que parece ser esta conta (ainda não marcada). */
  match: { id: string; description: string; date: string; amount: number } | null;
};

export type BillSuggestion = { tone: "alerta" | "info" | "bom"; text: string };

export type MonthBillsSummary = {
  monthKey: string;
  isCurrentMonth: boolean;
  pagar: MonthBill[];
  receber: MonthBill[];
  totals: {
    pagar: number;
    pago: number;
    faltaPagar: number;
    receber: number;
    recebido: number;
    faltaReceber: number;
    /** Mês atual: saldo em conta + o que falta receber − o que falta pagar. Outros meses: receber − pagar. */
    sobra: number;
  };
  suggestions: BillSuggestion[];
};

const NEAR_DAYS = 3;
const MATCH_DAYS = 7;

export function billPaymentKey(kind: BillKind, id: string, dueDate: string): string {
  return `${kind}:${id}:${dueDate}`;
}

export function dueDateInMonth(monthKey: string, day: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const clamped = clampDayToMonth(year, month - 1, Math.max(1, Math.min(31, Math.round(day))));
  return `${monthKey}-${String(clamped).padStart(2, "0")}`;
}

function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function statusFor(done: boolean, dueDate: string, todayKey: string): BillStatus {
  if (done) return "feito";
  if (dueDate < todayKey) return "atrasado";
  if (dueDate === todayKey) return "hoje";
  if (dayDiff(todayKey, dueDate) <= NEAR_DAYS) return "proximo";
  return "futuro";
}

function dayLabel(dueDate: string): string {
  return `dia ${Number(dueDate.slice(8, 10))}`;
}

export function buildMonthBills({
  monthKey,
  todayKey,
  recurring,
  debts,
  cards,
  paidKeys,
  transactions = [],
  accountBalance = 0,
}: {
  monthKey: string;
  todayKey: string;
  recurring: RecurringItem[];
  debts: Debt[];
  cards: Card[];
  paidKeys: Set<string>;
  /** Lançamentos perto do mês (para achar no extrato o que já foi pago/recebido). */
  transactions?: Transaction[];
  accountBalance?: number;
}): MonthBillsSummary {
  const isCurrentMonth = todayKey.startsWith(monthKey);
  const monthStart = `${monthKey}-01`;
  const bills: MonthBill[] = [];

  const push = (bill: Omit<MonthBill, "status" | "match">) => {
    bills.push({ ...bill, status: statusFor(bill.done, bill.dueDate, todayKey), match: null });
  };

  for (const item of recurring) {
    if (!item.active) continue;
    const dueDate = dueDateInMonth(monthKey, item.day_of_month);
    push({
      kind: "recurring",
      id: item.id,
      side: item.type === "entrada" ? "receber" : "pagar",
      description: item.description,
      amount: Number(item.amount) || 0,
      category: item.category,
      dueDate,
      recurring: true,
      fromBank: false,
      done: paidKeys.has(billPaymentKey("recurring", item.id, dueDate)),
    });
  }

  for (const debt of debts) {
    if (!debt.due_date) continue;
    const inMonth = debt.due_date.startsWith(monthKey);
    // Conta de uma vez só atrasada de meses anteriores continua aparecendo no mês atual.
    const overdue = isCurrentMonth && !debt.paid && debt.due_date < monthStart;
    if (!inMonth && !overdue) continue;
    push({
      kind: "debt",
      id: debt.id,
      side: "pagar",
      description: debt.person ? `${debt.description} (${debt.person})` : debt.description,
      amount: Number(debt.amount) || 0,
      category: "Contas",
      dueDate: debt.due_date,
      recurring: false,
      fromBank: false,
      done: debt.paid,
    });
  }

  for (const card of cards) {
    const invoice = Number(card.current_invoice) || 0;
    if (!card.due_day) continue;
    const dueDate = dueDateInMonth(monthKey, card.due_day);
    const done = paidKeys.has(billPaymentKey("card", card.id, dueDate));
    if (invoice <= 0 && !done) continue;
    push({
      kind: "card",
      id: card.id,
      side: "pagar",
      description: `Fatura ${card.name}`,
      amount: invoice,
      category: "Cartão",
      dueDate,
      recurring: true,
      fromBank: card.source === "pluggy",
      done,
    });
  }

  // Achar no extrato o que parece já ter sido pago/recebido (sugestão, o usuário confirma).
  const used = new Set<string>();
  for (const bill of bills) {
    if (bill.done || bill.amount <= 0) continue;
    const tolerance = Math.max(1, bill.amount * 0.03);
    const candidate = transactions.find((transaction) => {
      if (used.has(transaction.id)) return false;
      if (transaction.type !== (bill.side === "receber" ? "entrada" : "saida")) return false;
      if (bill.kind === "card" ? !isCardBillPayment(transaction) : isCardBillPayment(transaction)) return false;
      if (Math.abs(Number(transaction.amount) - bill.amount) > tolerance) return false;
      return Math.abs(dayDiff(bill.dueDate, transaction.date)) <= MATCH_DAYS;
    });
    if (candidate) {
      used.add(candidate.id);
      bill.match = {
        id: candidate.id,
        description: candidate.description,
        date: candidate.date,
        amount: Number(candidate.amount),
      };
    }
  }

  const byDue = (left: MonthBill, right: MonthBill) =>
    Number(left.done) - Number(right.done) || left.dueDate.localeCompare(right.dueDate) || right.amount - left.amount;
  const pagar = bills.filter((bill) => bill.side === "pagar").sort(byDue);
  const receber = bills.filter((bill) => bill.side === "receber").sort(byDue);

  const sum = (list: MonthBill[]) => round(list.reduce((total, bill) => total + bill.amount, 0));
  const totalPagar = sum(pagar);
  const pago = sum(pagar.filter((bill) => bill.done));
  const totalReceber = sum(receber);
  const recebido = sum(receber.filter((bill) => bill.done));
  const faltaPagar = round(totalPagar - pago);
  const faltaReceber = round(totalReceber - recebido);
  const sobra = isCurrentMonth
    ? round(accountBalance + faltaReceber - faltaPagar)
    : round(totalReceber - totalPagar);

  const totals = { pagar: totalPagar, pago, faltaPagar, receber: totalReceber, recebido, faltaReceber, sobra };
  return {
    monthKey,
    isCurrentMonth,
    pagar,
    receber,
    totals,
    suggestions: suggestionsFor({ pagar, receber, totals, isCurrentMonth, todayKey, monthKey }),
  };
}

function suggestionsFor({
  pagar,
  receber,
  totals,
  isCurrentMonth,
  todayKey,
  monthKey,
}: {
  pagar: MonthBill[];
  receber: MonthBill[];
  totals: MonthBillsSummary["totals"];
  isCurrentMonth: boolean;
  todayKey: string;
  monthKey: string;
}): BillSuggestion[] {
  const tips: BillSuggestion[] = [];
  if (pagar.length === 0 && receber.length === 0) {
    return [
      {
        tone: "info",
        text: "Cadastre suas contas fixas (água, luz, aluguel, internet) e o que você recebe (salário) para o app acompanhar o seu mês e te avisar dos vencimentos.",
      },
    ];
  }

  for (const bill of pagar.filter((item) => item.status === "atrasado").slice(0, 2)) {
    tips.push({
      tone: "alerta",
      text: `${bill.description} venceu ${dayLabel(bill.dueDate)} (${formatCurrency(bill.amount)}). Se já pagou, toque no ✓ para marcar.`,
    });
  }

  const matched = [...pagar, ...receber].filter((bill) => bill.match);
  if (matched.length > 0) {
    const first = matched[0];
    tips.push({
      tone: "info",
      text:
        matched.length === 1
          ? `Achei no extrato um lançamento que parece ser “${first.description}”. Confirme tocando em “Marcar”.`
          : `Achei no extrato ${matched.length} lançamentos que parecem contas desta lista. Confirme tocando em “Marcar”.`,
    });
  }

  if (isCurrentMonth) {
    for (const bill of pagar.filter((item) => item.status === "hoje" || item.status === "proximo").slice(0, 2)) {
      const days = dayDiff(todayKey, bill.dueDate);
      tips.push({
        tone: "info",
        text: `${bill.description} vence ${days === 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`} · ${formatCurrency(bill.amount)}.`,
      });
    }

    if (totals.sobra < 0) {
      const biggest = pagar.filter((bill) => !bill.done).sort((a, b) => b.amount - a.amount)[0];
      tips.push({
        tone: "alerta",
        text: `Faltam ${formatCurrency(Math.abs(totals.sobra))} para cobrir as contas do mês. Segure os gastos que não são essenciais${
          biggest ? ` ou tente negociar/parcelar “${biggest.description}”` : ""
        }.`,
      });
    } else if (totals.faltaPagar > 0) {
      const nextIncome = receber.find((bill) => !bill.done && bill.dueDate >= todayKey);
      const [year, month] = monthKey.split("-").map(Number);
      const monthEnd = `${monthKey}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
      const until = nextIncome?.dueDate ?? monthEnd;
      const days = Math.max(1, dayDiff(todayKey, until));
      tips.push({
        tone: "bom",
        text: `Depois de pagar tudo, sobram ${formatCurrency(totals.sobra)} — cerca de ${formatCurrency(
          totals.sobra / days,
        )} por dia até ${nextIncome ? `${dayLabel(until)} (${nextIncome.description})` : "o fim do mês"}.`,
      });
    }
  } else if (totals.sobra < 0) {
    tips.push({
      tone: "alerta",
      text: `Neste mês as contas passam o que você recebe em ${formatCurrency(Math.abs(totals.sobra))}. Vale se planejar antes.`,
    });
  }

  if (pagar.length >= 3 && totals.pagar > 0) {
    const top = [...pagar].sort((a, b) => b.amount - a.amount)[0];
    const share = top.amount / totals.pagar;
    if (share >= 0.4) {
      tips.push({
        tone: "info",
        text: `${top.description} é ${Math.round(share * 100)}% de tudo o que você paga no mês.`,
      });
    }
  }

  if (pagar.length > 0 && totals.faltaPagar === 0) {
    tips.push({ tone: "bom", text: "Todas as contas do mês estão pagas ✓" });
  }

  return tips;
}
