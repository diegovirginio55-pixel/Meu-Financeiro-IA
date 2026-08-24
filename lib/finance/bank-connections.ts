import type { SupabaseClient } from "@supabase/supabase-js";
import type { Account, BankConnection, Card, Investment } from "./types";
import { inferInstitutionName, isGenericConnectorName } from "@/lib/pluggy/institution";

export type BankConnectionWithAssets = BankConnection & {
  accounts: Account[];
  cards: Card[];
  investments: Investment[];
};

export async function getBankConnectionsWithAssets(
  supabase: SupabaseClient,
): Promise<BankConnectionWithAssets[]> {
  const [connRes, accRes, cardRes, invRes] = await Promise.all([
    supabase.from("bank_connections").select("*").order("created_at", { ascending: false }),
    supabase.from("accounts").select("*"),
    supabase.from("cards").select("*"),
    supabase.from("investments").select("*"),
  ]);

  const connections = (connRes.data ?? []) as BankConnection[];
  const accounts = (accRes.data ?? []) as Account[];
  const cards = (cardRes.data ?? []) as Card[];
  const investments = (invRes.data ?? []) as Investment[];

  const usedAccountIds = new Set<string>();
  const usedCardIds = new Set<string>();
  const usedInvestmentIds = new Set<string>();

  const result: BankConnectionWithAssets[] = connections.map((connection) => {
    const linkedAccounts = accounts.filter((a) => a.bank_connection_id === connection.id);
    const linkedCards = cards.filter((c) => c.bank_connection_id === connection.id);
    const linkedInvestments = investments.filter((i) => i.bank_connection_id === connection.id);
    linkedAccounts.forEach((a) => usedAccountIds.add(a.id));
    linkedCards.forEach((c) => usedCardIds.add(c.id));
    linkedInvestments.forEach((i) => usedInvestmentIds.add(i.id));

    const displayName = isGenericConnectorName(connection.institution_name)
      ? inferInstitutionName(
          [...linkedAccounts, ...linkedCards, ...linkedInvestments].map((item) => item.name),
          connection.institution_name,
        )
      : connection.institution_name;

    return {
      ...connection,
      institution_name: displayName,
      accounts: linkedAccounts,
      cards: linkedCards,
      investments: linkedInvestments,
    };
  });

  if (result.length === 1) {
    const leftoversAccounts = accounts.filter(
      (a) => a.source === "pluggy" && !usedAccountIds.has(a.id),
    );
    const leftoversCards = cards.filter((c) => c.source === "pluggy" && !usedCardIds.has(c.id));
    const leftoversInvestments = investments.filter(
      (i) => i.source === "pluggy" && !usedInvestmentIds.has(i.id),
    );
    result[0].accounts.push(...leftoversAccounts);
    result[0].cards.push(...leftoversCards);
    result[0].investments.push(...leftoversInvestments);
    if (isGenericConnectorName(result[0].institution_name)) {
      result[0].institution_name = inferInstitutionName(
        [...result[0].accounts, ...result[0].cards, ...result[0].investments].map((item) => item.name),
        result[0].institution_name,
      );
    }
  }

  return result;
}
