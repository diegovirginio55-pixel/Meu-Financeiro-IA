import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serverError } from "@/lib/api/errors";
import { isValidDateKey, parseMoney, parsePositiveMoney } from "@/lib/finance/validation";

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
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if ("name" in body) {
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
    if (!name) return NextResponse.json({ error: "Informe o nome da meta." }, { status: 400 });
    updates.name = name;
  }
  if ("target_amount" in body) {
    const target = parsePositiveMoney(body.target_amount);
    if (target == null) return NextResponse.json({ error: "Valor objetivo inválido." }, { status: 400 });
    updates.target_amount = target;
  }
  if ("deadline" in body) {
    if (body.deadline === null || body.deadline === "") updates.deadline = null;
    else if (isValidDateKey(body.deadline)) updates.deadline = body.deadline;
    else return NextResponse.json({ error: "Prazo inválido." }, { status: 400 });
  }

  let contribution: number | null = null;
  if ("add_amount" in body) {
    contribution = parseMoney(body.add_amount);
    if (contribution == null || contribution === 0) {
      return NextResponse.json({ error: "Valor do aporte inválido." }, { status: 400 });
    }
    const { data: current } = await supabase.from("goals").select("current_amount").eq("id", id).maybeSingle();
    if (!current) return NextResponse.json({ error: "Meta não encontrada." }, { status: 404 });
    updates.current_amount = Math.max(0, Math.round((Number(current.current_amount) + contribution) * 100) / 100);
  } else if ("current_amount" in body) {
    const value = parseMoney(body.current_amount);
    if (value == null || value < 0) return NextResponse.json({ error: "Valor atual inválido." }, { status: 400 });
    updates.current_amount = value;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const { data, error } = await supabase.from("goals").update(updates).eq("id", id).select().single();
  if (error) return serverError("Não foi possível atualizar a meta.", error);

  // Histórico de aportes só depois de a meta ter sido atualizada de fato.
  if (contribution != null) {
    const { error: contributionError } = await supabase.from("goal_contributions").insert({
      user_id: userData.user.id,
      goal_id: id,
      amount: contribution,
    });
    if (contributionError) console.error("Erro ao registrar aporte:", contributionError);
  }

  return NextResponse.json({ goal: data });
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

  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) return serverError("Não foi possível excluir a meta.", error);
  return NextResponse.json({ success: true });
}
