import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Lista as últimas notificações (alertas inteligentes, resumo semanal, movimentações) do usuário. */
export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("notification_log")
    .select("id, kind, title, body, url, sent_at, read_at")
    .eq("user_id", userData.user.id)
    .not("title", "is", null)
    .order("sent_at", { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notifications: data ?? [] });
}

/** Marca notificações como lidas (todas, ou uma específica via { id }). */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : null;

  let query = supabase
    .from("notification_log")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userData.user.id)
    .is("read_at", null);
  if (id) query = query.eq("id", id);

  const { error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
