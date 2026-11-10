import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serverError } from "@/lib/api/errors";
import { isValidDateKey, normalizeCategory, parsePositiveMoney } from "@/lib/finance/validation";

type Params = { params: Promise<{ kind: string; id: string }> };

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? supabase : null;
}

/** Edita uma conta do mês (recorrência ou conta de uma vez só). Faturas de cartão vêm do banco. */
export async function PATCH(request: Request, { params }: Params) {
  const { kind, id } = await params;
  const supabase = await requireUser();
  if (!supabase) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if ("description" in body) {
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 80) : "";
    if (!description) return NextResponse.json({ error: "Informe o nome da conta." }, { status: 400 });
    updates.description = description;
  }
  if ("amount" in body) {
    const amount = parsePositiveMoney(body.amount);
    if (amount === null) return NextResponse.json({ error: "Informe um valor maior que zero." }, { status: 400 });
    updates.amount = amount;
  }

  if (kind === "recurring") {
    if ("day" in body) {
      const day = Math.round(Number(body.day));
      if (!Number.isFinite(day) || day < 1 || day > 31) {
        return NextResponse.json({ error: "Informe o dia do mês (1 a 31)." }, { status: 400 });
      }
      updates.day_of_month = day;
    }
    if ("category" in body) updates.category = normalizeCategory(body.category);
    const { data, error } = await supabase.from("recurring_items").update(updates).eq("id", id).select("id").maybeSingle();
    if (error) return serverError("Não foi possível salvar a conta.", error);
    if (!data) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  if (kind === "debt") {
    if ("dueDate" in body) {
      if (!isValidDateKey(body.dueDate)) return NextResponse.json({ error: "Data inválida." }, { status: 400 });
      updates.due_date = body.dueDate;
    }
    const { data, error } = await supabase.from("debts").update(updates).eq("id", id).select("id").maybeSingle();
    if (error) return serverError("Não foi possível salvar a conta.", error);
    if (!data) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "A fatura do cartão vem do banco e não pode ser editada aqui." }, { status: 400 });
}

/** Tira a conta da lista: a recorrência é desativada (o histórico fica), a conta de uma vez é apagada. */
export async function DELETE(_request: Request, { params }: Params) {
  const { kind, id } = await params;
  const supabase = await requireUser();
  if (!supabase) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (kind === "recurring") {
    const { data, error } = await supabase.from("recurring_items").update({ active: false }).eq("id", id).select("id").maybeSingle();
    if (error) return serverError("Não foi possível remover a conta.", error);
    if (!data) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }
  if (kind === "debt") {
    const { error } = await supabase.from("debts").delete().eq("id", id);
    if (error) return serverError("Não foi possível remover a conta.", error);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "A fatura do cartão vem do banco." }, { status: 400 });
}
