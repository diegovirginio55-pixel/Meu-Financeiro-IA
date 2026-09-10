import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.from("category_rules").select("*").order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rules: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const pattern = typeof body?.pattern === "string" ? body.pattern.trim() : "";
  const category = typeof body?.category === "string" ? body.category.trim() : "";

  if (!pattern || !category) {
    return NextResponse.json({ error: "Informe o texto e a categoria da regra." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("category_rules")
    .insert({ user_id: userData.user.id, pattern, category })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rule: data });
}
