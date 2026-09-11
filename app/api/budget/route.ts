import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saoPauloMonthKey } from "@/lib/finance/fluxo";

/**
 * Orçamento do mês atual: quanto o usuário está disposto a gastar e a
 * economizar. GET devolve o registro do mês atual (ou nulo, se ainda não
 * definiu). PUT cria/atualiza (upsert por mês).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const monthKey = saoPauloMonthKey();
  const { data, error } = await supabase
    .from("monthly_budgets")
    .select("*")
    .eq("month_key", monthKey)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ budget: data ?? null });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const spendingLimitRaw = body?.spending_limit;
  const savingsTargetRaw = body?.savings_target;
  const spendingLimit =
    spendingLimitRaw === null || spendingLimitRaw === undefined || spendingLimitRaw === ""
      ? null
      : Number(spendingLimitRaw);
  const savingsTarget =
    savingsTargetRaw === null || savingsTargetRaw === undefined || savingsTargetRaw === ""
      ? null
      : Number(savingsTargetRaw);

  if (spendingLimit != null && (!Number.isFinite(spendingLimit) || spendingLimit < 0)) {
    return NextResponse.json({ error: "Valor de gasto inválido." }, { status: 400 });
  }
  if (savingsTarget != null && (!Number.isFinite(savingsTarget) || savingsTarget < 0)) {
    return NextResponse.json({ error: "Valor de economia inválido." }, { status: 400 });
  }

  const monthKey = saoPauloMonthKey();
  const { data, error } = await supabase
    .from("monthly_budgets")
    .upsert(
      {
        user_id: userData.user.id,
        month_key: monthKey,
        spending_limit: spendingLimit,
        savings_target: savingsTarget,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,month_key" },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ budget: data });
}
