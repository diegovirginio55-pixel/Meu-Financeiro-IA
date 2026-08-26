import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.from("goals").select("*").order("created_at");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ goals: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const targetAmount = Number(body?.target_amount);
  const currentAmount = Number(body?.current_amount ?? 0);
  const deadline = typeof body?.deadline === "string" && body.deadline ? body.deadline : null;

  if (!name || !Number.isFinite(targetAmount) || targetAmount <= 0) {
    return NextResponse.json({ error: "Informe um nome e um valor objetivo válido." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: userData.user.id,
      name,
      target_amount: targetAmount,
      current_amount: Number.isFinite(currentAmount) ? currentAmount : 0,
      deadline,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ goal: data });
}
