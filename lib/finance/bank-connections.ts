import type { SupabaseClient } from "@supabase/supabase-js";
import type { Account, BankConnection, Card, Investment, InvestmentSnapshot, InvestmentTxn, Transaction } from "./types";
import { inferInstitutionName, isGenericConnectorName } from "@/lib/pluggy/institution";
import { officialInstitutionName } from "@/lib/pluggy/brands";
import { groupedConnectionId, institutionFromAssetName, realConnectionId } from "./connection-filter";
import { applicationTxAsBuys, withAccruedYield } from "./investment-yield";

export type BankConnectionWithAssets = BankConnection & {
  accounts: Account[];
  cards: Card[];
  investments: Investment[];
};

export async function getBankConnectionsWithAssets(
  supabase: SupabaseClient,
): Promise<BankConnectionWithAssets[]> {
  const lookback = new Date();
  lookback.setDate(lookback.getDate() - 180);
  const from = lookback.toISOString().slice(0, 10);

  const [connRes, accRes, cardRes, invRes, snapRes, txRes, appRes] = await Promise.all([
    supabase.from("bank_connections").select("*").order("created_at", { ascending: false }),
    supabase.from("accounts").select("*"),
    supabase.from("cards").select("*"),
    supabase.from("investments").select("*"),
    supabase.from("investment_snapshots").select("*").gte("snapshot_date", from),
    supabase.from("investment_transactions").select("*").gte("date", from),
    supabase.from("transactions").select("id, description, amount, date").eq("type", "saida").gte("date", from),
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
    result[0].accounts.push(...leftoversAccounts);
    result[0].cards.push(...leftoversCards);
    leftoversAccounts.forEach((item) => usedAccountIds.add(item.id));
    leftoversCards.forEach((item) => usedCardIds.add(item.id));
    if (isGenericConnectorName(result[0].institution_name)) {
      result[0].institution_name = inferInstitutionName(
        [...result[0].accounts, ...result[0].cards, ...result[0].investments].map((item) => item.name),
        result[0].institution_name,
      );
    }
  }

  const leftoverInvestments = investments.filter((item) => !usedInvestmentIds.has(item.id));
  for (const investment of leftoverInvestments) {
    const inferred = institutionFromAssetName(investment.name, "");
    const target =
      (inferred
        ? result.find((connection) => officialInstitutionName(connection.institution_name) === inferred)
        : undefined) ??
      result.find(
        (connection) =>
          investment.bank_connection_id &&
          (connection.id === investment.bank_connection_id ||
            realConnectionId(connection.id) === investment.bank_connection_id),
      ) ??
      result[0];
    if (!target) continue;
    target.investments.push(investment);
    usedInvestmentIds.add(investment.id);
  }

  const snapshots = (snapRes.data ?? []) as InvestmentSnapshot[];
  const investmentTx = [
    ...((txRes.data ?? []) as InvestmentTxn[]),
    ...applicationTxAsBuys(investments, (appRes.data ?? []) as Transaction[]),
  ];

  return splitConnectionsByInstitution(result).map((connection) => ({
    ...connection,
    investments: uniqueInvestments(withAccruedYield(connection.investments, snapshots, investmentTx)),
  }));
}

function investmentDedupeKey(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^[^·•]+[·•]\s*/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function uniqueInvestments(investments: Investment[]): Investment[] {
  const filtered = investments.filter((item) => !isIssuerOnlyInvestment(item.name));
  const bestByName = new Map<string, Investment>();
  for (const item of filtered) {
    const key = investmentDedupeKey(item.name) || item.id;
    const existing = bestByName.get(key);
    if (!existing || Number(item.amount) > Number(existing.amount)) {
      bestByName.set(key, item);
    }
  }
  return filtered.filter((item) => {
    const key = investmentDedupeKey(item.name) || item.id;
    return bestByName.get(key)?.id === item.id;
  });
}

function isIssuerOnlyInvestment(name: string): boolean {
  const cleaned = investmentDedupeKey(name);
  if (/\b(lci|lca|cdb|lcd|cri|cra|tesouro|fundo|previdencia)\b/.test(cleaned)) return false;
  return /nu financeira|nufin|financeira sa|sociedade de credito/.test(cleaned);
}

function splitConnectionsByInstitution(connections: BankConnectionWithAssets[]): BankConnectionWithAssets[] {
  const exploded: BankConnectionWithAssets[] = [];

  for (const connection of connections) {
    const fallback = connection.institution_name || "Outros";
    const groups = new Map<string, { accounts: Account[]; cards: Card[]; investments: Investment[] }>();

    function add(
      kind: "accounts" | "cards" | "investments",
      item: Account | Card | Investment,
    ) {
      const inferred = institutionFromAssetName(item.name, "");
      const bank = inferred || (kind === "investments" ? "__pending__" : fallback);
      const group = groups.get(bank) ?? { accounts: [], cards: [], investments: [] };
      (group[kind] as typeof item[]).push(item);
      groups.set(bank, group);
    }

    connection.accounts.forEach((item) => add("accounts", item));
    connection.cards.forEach((item) => add("cards", item));
    connection.investments.forEach((item) => add("investments", item));

    const pending = groups.get("__pending__");
    if (pending) {
      groups.delete("__pending__");
      const targetBank =
        (!isGenericConnectorName(fallback) ? fallback : null) ??
        [...groups.keys()][0] ??
        fallback;
      const target = groups.get(targetBank) ?? { accounts: [], cards: [], investments: [] };
      target.investments.push(...pending.investments);
      groups.set(targetBank, target);
    }

    if (groups.size <= 1) {
      const only = groups.keys().next().value as string | undefined;
      exploded.push({
        ...connection,
        institution_name: only ?? connection.institution_name,
      });
      continue;
    }

    for (const [bank, assets] of groups) {
      exploded.push({
        ...connection,
        id: groupedConnectionId(connection.id, bank),
        institution_name: bank,
        accounts: assets.accounts,
        cards: assets.cards,
        investments: assets.investments,
      });
    }
  }

  return exploded;
}
