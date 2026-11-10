import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serverError } from "@/lib/api/errors";
import { isValidDateKey } from "@/lib/finance/validation";
import { markBillPaid, type BillKind } from "@/lib/finance/bill-reminders";

const KINDS: BillKind[] = ["recurring", "debt", "card"];

/**
 * Marca (ou desmarca) uma conta do mês como paga/recebida naquele
 * vencimento. Usa o mesmo registro do botão "Já paguei" das notificações,
 * então o lembrete daquela conta para de chegar.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const kind = body?.kind as BillKind;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!body || !KINDS.includes(kind) || !id || !isValidDateKey(body.dueDate)) {
    return NextResponse.json({ error: "Conta inválida." }, { status: 400 });
  }
  const dueDate = body.dueDate as string;

  if (body.done !== false) {
    const result = await markBillPaid(supabase, user.id, { kind, id, dueDate });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, done: true });
  }

  const { error } = await supabase
    .from("bill_payments")
    .delete()
    .eq("user_id", user.id)
    .eq("kind", kind)
    .eq("ref_id", id)
    .eq("due_date", dueDate);
  if (error) return serverError("Não foi possível desmarcar a conta.", error);
  if (kind === "debt") {
    const { error: debtError } = await supabase.from("debts").update({ paid: false }).eq("id", id).eq("user_id", user.id);
    if (debtError) return serverError("Não foi possível desmarcar a conta.", debtError);
  }
  return NextResponse.json({ ok: true, done: false });
}
