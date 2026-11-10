import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serverError } from "@/lib/api/errors";
import { isValidDateKey, normalizeCategory, parsePositiveMoney } from "@/lib/finance/validation";

/**
 * Contas do mês: cadastra uma conta a pagar ou algo a receber.
 * - "todo mês" → recurring_items (dia do mês);
 * - "só uma vez" (a pagar) → debts com data de vencimento.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });

  const side = body.side === "receber" ? "receber" : "pagar";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 80) : "";
  if (!description) return NextResponse.json({ error: "Informe o nome da conta." }, { status: 400 });
  const amount = parsePositiveMoney(body.amount);
  if (amount === null) return NextResponse.json({ error: "Informe um valor maior que zero." }, { status: 400 });

  if (body.recurring === false) {
    if (side === "receber") {
      return NextResponse.json({ error: "Valor a receber de uma vez só ainda não é suportado." }, { status: 400 });
    }
    if (!isValidDateKey(body.dueDate)) return NextResponse.json({ error: "Informe a data de vencimento." }, { status: 400 });
    const { data, error } = await supabase
      .from("debts")
      .insert({ description, amount, due_date: body.dueDate, paid: false })
      .select("id")
      .single();
    if (error) return serverError("Não foi possível salvar a conta.", error);
    return NextResponse.json({ ok: true, kind: "debt", id: data.id });
  }

  const day = Math.round(Number(body.day));
  if (!Number.isFinite(day) || day < 1 || day > 31) {
    return NextResponse.json({ error: "Informe o dia do mês (1 a 31)." }, { status: 400 });
  }
  const category = normalizeCategory(body.category ?? (side === "receber" ? "Salário" : "Outros"));
  const { data, error } = await supabase
    .from("recurring_items")
    .insert({
      description,
      amount,
      type: side === "receber" ? "entrada" : "saida",
      category,
      day_of_month: day,
      active: true,
    })
    .select("id")
    .single();
  if (error) return serverError("Não foi possível salvar a conta.", error);
  return NextResponse.json({ ok: true, kind: "recurring", id: data.id });
}
