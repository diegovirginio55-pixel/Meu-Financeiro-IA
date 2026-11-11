import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPushAction } from "@/lib/push/actions";
import { CATEGORIES, CATEGORY_ICONS } from "@/lib/finance/categories";
import { markBillPaid } from "@/lib/finance/bill-reminders";
import { serverError } from "@/lib/api/errors";
import { learnCategoryChoice, learnedMessage } from "@/lib/finance/category-learning";

/**
 * Botões das notificações push ("🍔 Alimentação", "✅ Já paguei"). Chamado
 * pelo service worker sem abrir o app — por isso não usa sessão: quem
 * autoriza é o token assinado que veio no próprio push, preso a UM
 * lançamento (ou UMA conta) e com validade.
 *
 * Responde com o título/texto da notificação de confirmação.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const claim = verifyPushAction(body?.token);
  const action = typeof body?.action === "string" ? body.action : "";
  if (!claim) {
    return NextResponse.json({ error: "Este botão expirou. Abra o app para concluir." }, { status: 401 });
  }

  const supabase = createAdminClient();

  if (claim.k === "tx") {
    const category = action.startsWith("cat:") ? action.slice(4) : "";
    if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
      return NextResponse.json({ error: "Categoria inválida." }, { status: 400 });
    }
    // Só a categoria muda: o sync do banco preserva a categoria escolhida.
    const { data, error } = await supabase
      .from("transactions")
      .update({ category })
      .eq("id", claim.t)
      .eq("user_id", claim.u)
      .select("description, type")
      .maybeSingle();
    if (error) return serverError("Não foi possível categorizar.", error);
    if (!data) return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
    // Pix para alguém: os próximos (e os antigos ainda sem categoria) dessa pessoa vão junto.
    const learned = await learnCategoryChoice(
      supabase,
      claim.u,
      { id: claim.t, description: data.description, type: data.type },
      category,
    );
    const extra = learnedMessage(learned);
    return NextResponse.json({
      ok: true,
      title: `${CATEGORY_ICONS[category] ?? "✅"} Categorizado como ${category}`,
      body: extra ? `${data.description}\n${extra}` : data.description,
    });
  }

  if (action !== "paid") {
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  }
  const result = await markBillPaid(supabase, claim.u, { kind: claim.b, id: claim.r, dueDate: claim.d });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({
    ok: true,
    title: "✅ Conta marcada como paga",
    body: `${result.description} — não vou lembrar de novo deste vencimento.`,
  });
}
