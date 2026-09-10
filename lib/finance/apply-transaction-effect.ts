import type { SupabaseClient } from "@supabase/supabase-js";

export interface TransactionEffect {
  account_id: string | null;
  card_id: string | null;
  type: "entrada" | "saida";
  amount: number;
}

/**
 * Aplica (ou reverte, se sign = -1) o efeito de uma transação no saldo da
 * conta ou na fatura do cartão vinculado. Uma "entrada" soma no saldo da
 * conta; uma "saida" subtrai. No cartão é o contrário: uma "saida" (compra)
 * aumenta a fatura, uma "entrada" (estorno/pagamento) reduz.
 *
 * Usado ao editar ou excluir um lançamento manualmente, pra que o saldo
 * mostrado continue correto (antes disso, editar/excluir não reajustava
 * nada). Contas/cartões sincronizados via Pluggy têm o saldo corrigido de
 * novo no próximo sync automático, então não há problema em ajustar aqui
 * também nesse caso.
 */
export async function applyTransactionEffect(
  supabase: SupabaseClient,
  effect: TransactionEffect,
  sign: 1 | -1,
): Promise<void> {
  const delta = effect.type === "entrada" ? effect.amount : -effect.amount;

  if (effect.account_id) {
    const { data: account } = await supabase
      .from("accounts")
      .select("balance")
      .eq("id", effect.account_id)
      .single();
    if (account) {
      const nextBalance = Number(account.balance) + sign * delta;
      await supabase
        .from("accounts")
        .update({ balance: nextBalance })
        .eq("id", effect.account_id);
    }
  }

  if (effect.card_id) {
    const { data: card } = await supabase
      .from("cards")
      .select("current_invoice")
      .eq("id", effect.card_id)
      .single();
    if (card) {
      // Na fatura do cartão o sinal é invertido: gasto (saida) aumenta a
      // fatura, estorno/entrada reduz.
      const nextInvoice = Number(card.current_invoice) - sign * delta;
      await supabase
        .from("cards")
        .update({ current_invoice: Math.max(0, nextInvoice) })
        .eq("id", effect.card_id);
    }
  }
}
