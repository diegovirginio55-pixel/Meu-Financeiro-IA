import { formatCurrency } from "@/lib/finance/format";
import type { DailyLimitStatus } from "@/lib/finance/daily-limit";
import { TRANSFER_CATEGORY } from "@/lib/finance/categories";

/** A partir de quanto do limite da categoria o aviso do gasto mostra o quanto já foi. */
const CATEGORY_SHOW_PCT = 0.7;

export type RealtimeMovement = {
  /** Id do lançamento (provisório) — botões de categoria e dedupe do aviso. */
  id: string;
  description: string;
  amount: number;
  type: "entrada" | "saida";
  category: string;
  bank: string | null;
  accountId: string | null;
};

export type RealtimeMovementContext = {
  /** Saldo em conta já com esta movimentação (null se não deu para calcular). */
  balance: number | null;
  /** Limite de hoje (só para gastos). */
  daily: DailyLimitStatus | null;
  /** Limite do mês da categoria deste gasto, se o usuário definiu um. */
  categoryLimit: { spent: number; limit: number } | null;
};

/**
 * Texto do aviso que sai assim que o celular encaminha a notificação do
 * banco: o que aconteceu, o saldo novo e como ficou o controle do dia
 * (quanto ainda pode gastar ou quanto passou) e da categoria. Função pura.
 */
export function realtimeMovementMessage(
  movement: Pick<RealtimeMovement, "description" | "amount" | "type" | "category" | "bank">,
  context: RealtimeMovementContext,
): { title: string; body: string } {
  const value = formatCurrency(movement.amount);
  const where = movement.bank ? ` · ${movement.bank}` : "";

  // Entre as próprias contas: só troca de lugar — sem limite do dia nem categoria.
  if (movement.category === TRANSFER_CATEGORY) {
    const lines = [movement.description, "Entre as suas contas: não conta como gasto"];
    if (context.balance != null) lines.push(`Saldo agora: ${formatCurrency(context.balance)}`);
    return { title: `🔁 Transferência ${value}${where}`, body: lines.join("\n") };
  }
  const title = movement.type === "entrada" ? `💰 Entrou ${value}${where}` : `💸 Saiu ${value}${where}`;

  const lines: string[] = [
    movement.type === "saida" ? `${movement.description} · ${movement.category}` : movement.description,
  ];
  if (context.balance != null) lines.push(`Saldo agora: ${formatCurrency(context.balance)}`);

  const daily = context.daily;
  if (movement.type === "saida" && daily) {
    if (daily.perDay > 1) {
      lines.push(
        daily.over > 0
          ? `⚠️ Passou ${formatCurrency(daily.over)} do limite de hoje (${formatCurrency(daily.perDay)})`
          : `✅ Ainda pode gastar ${formatCurrency(daily.remaining)} hoje`,
      );
    } else if (context.balance != null && context.balance <= 0) {
      lines.push("⚠️ Saldo zerado: evite novos gastos até a próxima entrada");
    }
  }

  const category = context.categoryLimit;
  if (movement.type === "saida" && category && category.limit > 0) {
    const pct = category.spent / category.limit;
    if (pct >= CATEGORY_SHOW_PCT) {
      const icon = pct >= 1 ? "🚨" : "⚠️";
      lines.push(
        `${icon} ${movement.category}: ${formatCurrency(category.spent)} de ${formatCurrency(category.limit)} (${Math.round(pct * 100)}%)`,
      );
    }
  }

  return { title, body: lines.join("\n") };
}
