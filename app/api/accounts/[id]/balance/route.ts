import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serverError } from "@/lib/api/errors";
import { parseMoney } from "@/lib/finance/validation";
import { saveBalanceOverride } from "@/lib/finance/balance-override";

/**
 * "Corrigir saldo": grava o saldo que o usuário vê no app do banco (vale
 * até a próxima atualização da Pluggy). Corpo: { balance: number } — ou
 * { balance: null } para voltar ao saldo do banco.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Lido com o login do usuário (RLS): só aceita conta dele.
  const { data: account, error: accountError } = await supabase.from("accounts").select("id").eq("id", id).maybeSingle();
  if (accountError) return serverError("Não foi possível conferir a conta.", accountError);
  if (!account) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { balance?: unknown } | null;
  if (!body || !("balance" in body)) return NextResponse.json({ error: "Informe o saldo." }, { status: 400 });

  const balance = body.balance === null ? null : parseMoney(body.balance);
  if (body.balance !== null && balance === null) {
    return NextResponse.json({ error: "Saldo inválido." }, { status: 400 });
  }

  try {
    await saveBalanceOverride(id, balance);
  } catch (error) {
    return serverError("Não foi possível salvar o saldo.", error);
  }
  return NextResponse.json({ ok: true, balance });
}
