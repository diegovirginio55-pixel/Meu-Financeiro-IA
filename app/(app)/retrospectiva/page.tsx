import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { saoPauloMonthKey, saoPauloTodayKey, shiftMonthKey } from "@/lib/finance/fluxo";
import { buildMonthRecap } from "@/lib/finance/month-recap";
import type { Transaction } from "@/lib/finance/types";
import RecapStories from "@/components/retrospectiva/RecapStories";

export const dynamic = "force-dynamic";

function lastDay(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Retrospectiva do mês (padrão: o mês passado). ?mes=AAAA-MM */
export default async function RetrospectivaPage({ searchParams }: { searchParams: Promise<{ mes?: string | string[] }> }) {
  const supabase = await createClient();
  const params = await searchParams;
  const current = saoPauloMonthKey();
  const wanted = typeof params.mes === "string" && /^\d{4}-\d{2}$/.test(params.mes) ? params.mes : shiftMonthKey(current, -1);
  const monthKey = wanted > current || wanted < shiftMonthKey(current, -12) ? shiftMonthKey(current, -1) : wanted;
  const previous = shiftMonthKey(monthKey, -1);

  const { data: tx } = await fetchAllRows<Transaction>((from, to) =>
    supabase
      .from("transactions")
      .select("*")
      .gte("date", `${previous}-01`)
      .lte("date", `${monthKey}-${String(lastDay(monthKey)).padStart(2, "0")}`)
      .order("date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );

  const today = saoPauloTodayKey();
  const daysCounted = monthKey === current ? Number(today.slice(8, 10)) : lastDay(monthKey);
  const recap = buildMonthRecap({
    monthKey,
    daysCounted,
    monthTx: tx.filter((t) => t.date.startsWith(monthKey)),
    prevMonthTx: tx.filter((t) => t.date.startsWith(previous)),
  });
  const months = Array.from({ length: 12 }, (_, i) => shiftMonthKey(current, -i));

  return <RecapStories recap={recap} isCurrentMonth={monthKey === current} months={months} />;
}
