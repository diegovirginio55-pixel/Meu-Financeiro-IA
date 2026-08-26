import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  saoPauloMonthStartKey,
  saoPauloTodayKey,
  saoPauloWeekStartKey,
  saoPauloYearStartKey,
} from "@/lib/finance/fluxo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

function resolveDateFrom(period: string | null): string | null {
  switch (period) {
    case "hoje":
      return saoPauloTodayKey();
    case "semana":
      return saoPauloWeekStartKey();
    case "mes":
      return saoPauloMonthStartKey();
    case "ano":
      return saoPauloYearStartKey();
    default:
      return null;
  }
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period");
  const category = searchParams.get("category");
  const accountId = searchParams.get("account_id");
  const cardId = searchParams.get("card_id");
  const type = searchParams.get("type");

  let query = supabase.from("transactions").select("*");

  const dateFrom = resolveDateFrom(period);
  if (dateFrom) query = query.gte("date", dateFrom);
  if (category) query = query.eq("category", category);
  if (accountId) query = query.eq("account_id", accountId);
  if (cardId) query = query.eq("card_id", cardId);
  if (type) query = query.eq("type", type);

  query = query.order("date", { ascending: false }).order("created_at", { ascending: false });

  const [{ data: transactions, error }, { data: accounts }, { data: cards }, { data: connections }] =
    await Promise.all([
      query,
      supabase.from("accounts").select("*").order("created_at"),
      supabase.from("cards").select("*").order("created_at"),
      supabase.from("bank_connections").select("id, institution_name"),
    ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE_HEADERS });
  }

  const bankNameById = new Map((connections ?? []).map((c) => [c.id, c.institution_name]));
  const accountsWithBank = (accounts ?? []).map((a) => ({
    ...a,
    institution_name: a.bank_connection_id ? bankNameById.get(a.bank_connection_id) ?? null : null,
  }));
  const cardsWithBank = (cards ?? []).map((c) => ({
    ...c,
    institution_name: c.bank_connection_id ? bankNameById.get(c.bank_connection_id) ?? null : null,
  }));

  return NextResponse.json(
    {
      transactions: transactions ?? [],
      accounts: accountsWithBank,
      cards: cardsWithBank,
    },
    { headers: NO_STORE_HEADERS },
  );
}
