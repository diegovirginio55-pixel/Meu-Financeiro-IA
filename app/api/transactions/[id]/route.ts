import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyTransactionChange, type TransactionEffect } from "@/lib/finance/apply-transaction-effect";
import { isMissingSchemaError } from "@/lib/supabase/schema-compat";
import { serverError } from "@/lib/api/errors";
import { parseTransactionUpdate } from "@/lib/finance/validation";

const EFFECT_FIELDS = "account_id, card_id, type, amount, pluggy_transaction_id, user_id";

type EffectRow = {
  account_id: string | null;
  card_id: string | null;
  type: "entrada" | "saida";
  amount: number;
  pluggy_transaction_id: string | null;
  user_id: string;
};

function effectOf(row: EffectRow): TransactionEffect {
  return {
    account_id: row.account_id,
    card_id: row.card_id,
    type: row.type,
    amount: Number(row.amount),
  };
}

function affectsBalance(before: EffectRow, after: EffectRow): boolean {
  return (
    before.account_id !== after.account_id ||
    before.card_id !== after.card_id ||
    before.type !== after.type ||
    Number(before.amount) !== Number(after.amount)
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = parseTransactionUpdate(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // Estado anterior: para reajustar o saldo só pela diferença.
  const { data: before } = await supabase
    .from("transactions")
    .select(EFFECT_FIELDS)
    .eq("id", id)
    .maybeSingle<EffectRow>();
  if (!before) {
    return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("transactions")
    .update(parsed.updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return serverError("Não foi possível salvar o lançamento.", error);

  // Marca como editado pelo usuário quando mudou algo que o sync do banco
  // sobrescreveria (descrição, valor, data, tipo, conta/cartão). Só a
  // categoria não precisa: o sync já preserva a categoria atual — e marcar
  // por isso impediria o lançamento de receber o valor definitivo do banco
  // (ex.: pré-autorização de posto que muda de valor). Separado do update
  // acima para funcionar mesmo antes da migration 0010 (coluna user_edited).
  const syncedFieldChanged = ["description", "amount", "date", "type", "account_id", "card_id"].some(
    (field) => field in parsed.updates,
  );
  if (before.pluggy_transaction_id && syncedFieldChanged) {
    const { error: flagError } = await supabase.from("transactions").update({ user_edited: true }).eq("id", id);
    if (flagError && !isMissingSchemaError(flagError)) {
      console.error("Erro ao marcar lançamento como editado:", flagError);
    }
  }

  if (affectsBalance(before, data as EffectRow)) {
    try {
      await applyTransactionChange(supabase, effectOf(before), effectOf(data as EffectRow));
    } catch (balanceError) {
      console.error("Erro ao reajustar saldo após editar lançamento:", balanceError);
    }
  }

  return NextResponse.json({ transaction: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: before } = await supabase
    .from("transactions")
    .select(EFFECT_FIELDS)
    .eq("id", id)
    .maybeSingle<EffectRow>();
  if (!before) {
    return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
  }

  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return serverError("Não foi possível excluir o lançamento.", error);

  // Lançamento importado do banco: guarda na "lixeira" para o próximo sync
  // não trazê-lo de volta.
  if (before.pluggy_transaction_id) {
    const { error: tombstoneError } = await supabase.from("deleted_pluggy_transactions").upsert(
      { user_id: userData.user.id, pluggy_transaction_id: before.pluggy_transaction_id },
      { onConflict: "user_id,pluggy_transaction_id", ignoreDuplicates: true },
    );
    if (tombstoneError && !isMissingSchemaError(tombstoneError)) {
      console.error("Erro ao registrar lançamento excluído:", tombstoneError);
    }
  }

  try {
    await applyTransactionChange(supabase, effectOf(before), null);
  } catch (balanceError) {
    console.error("Erro ao reajustar saldo após excluir lançamento:", balanceError);
  }

  return NextResponse.json({ success: true });
}
