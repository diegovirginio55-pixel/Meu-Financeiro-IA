import { NextResponse } from "next/server";
import { startOfDay, startOfWeek, startOfMonth, startOfYear, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";

function resolveDateFrom(period: string | null): string | null {
  const now = new Date();
  switch (period) {
    case "hoje":
      return format(startOfDay(now), "yyyy-MM-dd");
    case "semana":
      return format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    case "mes":
      return format(startOfMonth(now), "yyyy-MM-dd");
    case "ano":
      return format(startOfYear(now), "yyyy-MM-dd");
    default:
      return null;
  }
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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

  const [{ data: transactions, error }, { data: accounts }, { data: cards }] =
    await Promise.all([
      query,
      supabase.from("accounts").select("*").order("created_at"),
      supabase.from("cards").select("*").order("created_at"),
    ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    transactions: transactions ?? [],
    accounts: accounts ?? [],
    cards: cards ?? [],
  });
}
