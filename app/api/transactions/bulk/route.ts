import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Atualiza a categoria de vários lançamentos de uma vez (categorização em lote). */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? (body.ids as unknown[]).filter((v) => typeof v === "string") : [];
  const category = typeof body?.category === "string" ? body.category : "";

  if (ids.length === 0 || !category) {
    return NextResponse.json({ error: "Informe os lançamentos e a categoria." }, { status: 400 });
  }

  const { error } = await supabase
    .from("transactions")
    .update({ category })
    .in("id", ids)
    .eq("user_id", userData.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: ids.length });
}
