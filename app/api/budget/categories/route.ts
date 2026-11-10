import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serverError } from "@/lib/api/errors";
import { sanitizeCategoryLimits } from "@/lib/finance/category-budgets";
import { loadCategoryLimits, saveCategoryLimits } from "@/lib/finance/category-budgets-store";

/** Limites mensais por categoria. GET devolve; PUT troca todos ({ limits: { Alimentação: 800 } }). */
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ limits: await loadCategoryLimits(data.user.id) });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { limits?: unknown } | null;
  if (!body || typeof body.limits !== "object") return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  const limits = sanitizeCategoryLimits(body.limits);
  if (Object.keys(limits).length > 40) return NextResponse.json({ error: "Categorias demais." }, { status: 400 });

  try {
    await saveCategoryLimits(data.user.id, limits);
  } catch (error) {
    return serverError("Não foi possível salvar os limites.", error);
  }
  return NextResponse.json({ ok: true, limits });
}
