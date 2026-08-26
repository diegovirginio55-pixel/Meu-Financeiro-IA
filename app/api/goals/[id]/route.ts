import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const EDITABLE_FIELDS = ["name", "target_amount", "current_amount", "deadline"] as const;

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
  if (!body) {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (typeof body.add_amount === "number" && Number.isFinite(body.add_amount)) {
    const { data: current, error: fetchError } = await supabase
      .from("goals")
      .select("current_amount")
      .eq("id", id)
      .single();
    if (fetchError || !current) {
      return NextResponse.json({ error: fetchError?.message ?? "Meta não encontrada." }, { status: 404 });
    }
    updates.current_amount = Math.max(0, Number(current.current_amount) + body.add_amount);
  }

  for (const field of EDITABLE_FIELDS) {
    if (field in body && field !== "current_amount") updates[field] = body[field];
  }
  if ("current_amount" in body && !("add_amount" in body)) {
    updates.current_amount = body.current_amount;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const { data, error } = await supabase.from("goals").update(updates).eq("id", id).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
