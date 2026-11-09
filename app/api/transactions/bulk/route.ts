import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serverError } from "@/lib/api/errors";

const MAX_IDS = 2000;
const CHUNK = 150;

/**
 * Atualiza a categoria de vários lançamentos de uma vez (categorização em
 * lote). Não precisa marcar "editado pelo usuário": o sync do banco já
 * preserva a categoria atual e continua atualizando valor/data.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.ids)
    ? Array.from(new Set((body.ids as unknown[]).filter((v): v is string => typeof v === "string")))
    : [];
  const category = typeof body?.category === "string" ? body.category.trim().slice(0, 60) : "";

  if (ids.length === 0 || !category) {
    return NextResponse.json({ error: "Informe os lançamentos e a categoria." }, { status: 400 });
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json({ error: `Selecione no máximo ${MAX_IDS} lançamentos por vez.` }, { status: 400 });
  }

  // Em blocos: uma lista enorme de ids não cabe na URL da requisição.
  let count = 0;
  for (let index = 0; index < ids.length; index += CHUNK) {
    const { data, error } = await supabase
      .from("transactions")
      .update({ category })
      .in("id", ids.slice(index, index + CHUNK))
      .eq("user_id", userData.user.id)
      .select("id");
    if (error) return serverError("Não foi possível aplicar a categoria.", error);
    count += data?.length ?? 0;
  }

  return NextResponse.json({ success: true, count });
}
