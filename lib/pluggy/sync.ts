import type { SupabaseClient } from "@supabase/supabase-js";
import { isInvestmentDescription, promoteInvestmentsFromTransactions } from "@/lib/finance/investment-movements";
import { applyCategoryRules, inferCategoryFromDescription, type CategoryRule } from "@/lib/finance/categories";
import type { Account, Investment } from "@/lib/finance/types";
import { CDI_ANNUAL_FALLBACK } from "@/lib/finance/investment-yield";
import { pluggyApi, pluggyInvestmentAmount, resolvePluggyPosition, type PluggyAccount, type PluggyInvestment } from "./client";
import { officialInstitutionName } from "./brands";
import {
  bankFromLabel,
  inferInstitutionName,
  institutionForAccount,
  isGenericConnectorName,
  singleInstitutionFromAccounts,
  withInstitutionPrefix,
} from "./institution";
import { notifyBankMovements } from "@/lib/push/send";
import { isRecentMovementDate, recentMovements, type MovementNotice } from "@/lib/push/payload";
import { daysAgoKey, toSaoPauloDateOnly } from "@/lib/finance/fluxo";
import { isMissingSchemaError } from "@/lib/supabase/schema-compat";
import { cleanupStaleProvisional, reconcileProvisional } from "@/lib/ingest/provisional";

const TRANSACTIONS_LOOKBACK_DAYS = 90;

const CATEGORY_MAP: Record<string, string> = {
  restaurants: "Alimentação",
  "food and drink": "Alimentação",
  groceries: "Alimentação",
  transport: "Transporte",
  transportation: "Transporte",
  "auto & transport": "Transporte",
  housing: "Moradia",
  rent: "Moradia",
  utilities: "Moradia",
  education: "Educação",
  health: "Saúde",
  healthcare: "Saúde",
  pharmacy: "Saúde",
  entertainment: "Lazer",
  leisure: "Lazer",
  subscriptions: "Assinaturas",
  streaming: "Assinaturas",
  shopping: "Compras",
  investments: "Investimentos",
  loans: "Dívidas",
  "credit card payment": "Dívidas",
  salary: "Salário",
  income: "Salário",
};

function mapCategory(
  pluggyCategory: string | null | undefined,
  isCredit: boolean,
  description?: string | null,
  customRules: CategoryRule[] = [],
): string {
  if (description) {
    const custom = applyCategoryRules(description, customRules);
    if (custom) return custom;
  }
  if (description && isInvestmentDescription(description)) return "Investimentos";
  const inferred = description ? inferCategoryFromDescription(description) : null;
  if (inferred) return inferred;
  if (pluggyCategory) {
    const mapped = CATEGORY_MAP[pluggyCategory.toLowerCase()];
    if (mapped) return mapped;
  }
  return isCredit ? "Salário" : "Outros";
}

async function knownPluggyIds(
  supabase: SupabaseClient,
  table: "transactions" | "investment_transactions",
  ids: string[],
) {
  const known = new Set<string>();
  for (let index = 0; index < ids.length; index += 80) {
    const chunk = ids.slice(index, index + 80);
    const { data } = await supabase.from(table).select("pluggy_transaction_id").in("pluggy_transaction_id", chunk);
    for (const row of data ?? []) {
      if (row.pluggy_transaction_id) known.add(row.pluggy_transaction_id);
    }
  }
  return known;
}

type ExistingTransaction = {
  pluggy_transaction_id: string;
  description: string;
  amount: number;
  type: string;
  date: string;
  category: string;
  account_id: string | null;
  card_id: string | null;
  user_edited?: boolean | null;
};

const EXISTING_FIELDS = "pluggy_transaction_id, description, amount, type, date, category, account_id, card_id";
const ID_CHUNK = 80;

/** Lançamentos já gravados para esses ids da Pluggy (com a marca de "editado pelo usuário", se existir). */
async function existingPluggyTransactions(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, ExistingTransaction>> {
  const existing = new Map<string, ExistingTransaction>();
  let fields = `${EXISTING_FIELDS}, user_edited`;
  for (let index = 0; index < ids.length; index += ID_CHUNK) {
    const chunk = ids.slice(index, index + ID_CHUNK);
    let result = await supabase.from("transactions").select(fields).in("pluggy_transaction_id", chunk);
    if (result.error && fields !== EXISTING_FIELDS && isMissingSchemaError(result.error)) {
      fields = EXISTING_FIELDS;
      result = await supabase.from("transactions").select(fields).in("pluggy_transaction_id", chunk);
    }
    // Sem saber o que já existe não dá pra separar novos de antigos com
    // segurança (duplicaria push) — melhor abortar e tentar no próximo sync.
    if (result.error) throw result.error;
    for (const row of (result.data ?? []) as unknown as ExistingTransaction[]) {
      existing.set(row.pluggy_transaction_id, row);
    }
  }
  return existing;
}

/** Ids da Pluggy que o usuário excluiu no app (não devem voltar no sync). */
async function deletedPluggyIds(supabase: SupabaseClient, userId: string, ids: string[]): Promise<Set<string>> {
  const deleted = new Set<string>();
  for (let index = 0; index < ids.length; index += ID_CHUNK) {
    const { data, error } = await supabase
      .from("deleted_pluggy_transactions")
      .select("pluggy_transaction_id")
      .eq("user_id", userId)
      .in("pluggy_transaction_id", ids.slice(index, index + ID_CHUNK));
    if (error) {
      if (!isMissingSchemaError(error)) console.error("Erro ao ler lançamentos excluídos:", error);
      return deleted;
    }
    for (const row of data ?? []) deleted.add(row.pluggy_transaction_id as string);
  }
  return deleted;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

async function syncTransactionsForAccount(
  supabase: SupabaseClient,
  userId: string,
  pluggyAccountId: string,
  accountId: string | null,
  cardId: string | null,
): Promise<MovementNotice[]> {
  const transactions = await pluggyApi.fetchAllTransactions(pluggyAccountId, daysAgoKey(TRANSACTIONS_LOOKBACK_DAYS));
  if (transactions.length === 0) return [];

  const ids = transactions.map((item) => item.id);
  const [existing, deleted, ruleRes] = await Promise.all([
    existingPluggyTransactions(supabase, ids),
    deletedPluggyIds(supabase, userId, ids),
    supabase.from("category_rules").select("pattern, category").eq("user_id", userId),
  ]);
  const customRules = (ruleRes.data ?? []) as CategoryRule[];

  const rows = transactions
    .filter((t) => !deleted.has(t.id))
    .map((t) => ({
      user_id: userId,
      description: t.description || "Transação importada",
      amount: roundMoney(Math.abs(t.amount)),
      type: t.type === "CREDIT" ? "entrada" : "saida",
      category: mapCategory(t.category, t.type === "CREDIT", t.description, customRules),
      date: toSaoPauloDateOnly(t.date),
      account_id: accountId,
      card_id: cardId,
      pluggy_transaction_id: t.id,
      source: "pluggy" as const,
    }));

  const newRows = rows.filter((row) => !existing.has(row.pluggy_transaction_id));

  // Já existentes: atualiza só o que mudou no banco (ex.: pendente que virou
  // definitivo com outro valor) e nunca o que o usuário editou. A categoria
  // atual é mantida — o sync antigo regravava tudo e desfazia a
  // categorização em lote a cada 10 minutos.
  const changedRows = rows.flatMap((row) => {
    const current = existing.get(row.pluggy_transaction_id);
    if (!current || current.user_edited) return [];
    const changed =
      current.description !== row.description ||
      roundMoney(Number(current.amount)) !== row.amount ||
      current.type !== row.type ||
      current.date !== row.date ||
      current.account_id !== row.account_id ||
      current.card_id !== row.card_id;
    return changed ? [{ ...row, category: current.category }] : [];
  });

  // ignoreDuplicates + select devolve só as linhas realmente inseridas:
  // se dois syncs rodarem juntos, só um deles "vê" cada transação nova e
  // a notificação sai uma vez só.
  let inserted: { id: string; description: string; amount: number; type: string; date: string; category: string }[] = [];
  if (newRows.length > 0) {
    const { data, error } = await supabase
      .from("transactions")
      .upsert(newRows, { onConflict: "pluggy_transaction_id", ignoreDuplicates: true })
      .select("id, description, amount, type, date, category");
    if (error) console.error("Erro ao gravar transações novas da Pluggy:", error);
    else inserted = data ?? [];
  }

  if (changedRows.length > 0) {
    const { error } = await supabase
      .from("transactions")
      .upsert(changedRows, { onConflict: "pluggy_transaction_id" });
    if (error) console.error("Erro ao atualizar transações da Pluggy:", error);
  }

  // Lançamentos que já tinham chegado pela notificação do celular: troca o
  // provisório pelo oficial e não avisa de novo.
  let alreadyNotified = new Set<string>();
  try {
    alreadyNotified = await reconcileProvisional(supabase, userId, { accountId, cardId }, inserted);
  } catch (error) {
    console.error("Erro ao conciliar lançamentos provisórios:", error);
  }

  return inserted
    .filter((row) => !alreadyNotified.has(row.id))
    .filter((row) => isRecentMovementDate(row.date))
    .map((row) => ({
      id: row.id,
      description: row.description,
      amount: Number(row.amount),
      type: row.type,
      date: row.date,
      category: row.category,
    }));
}

/**
 * Evento "transactions/deleted" da Pluggy: a transação deixou de existir no
 * banco (ex.: pendente substituída por outra definitiva com id novo).
 * Remove a cópia local — exceto se o usuário editou.
 */
export async function removeDeletedPluggyTransactions(
  supabase: SupabaseClient,
  bankConnectionId: string,
  transactionIds: string[],
): Promise<number> {
  if (transactionIds.length === 0) return 0;
  const { data: connection } = await supabase
    .from("bank_connections")
    .select("user_id")
    .eq("id", bankConnectionId)
    .maybeSingle();
  if (!connection) return 0;

  let removed = 0;
  for (let index = 0; index < transactionIds.length; index += ID_CHUNK) {
    const chunk = transactionIds.slice(index, index + ID_CHUNK);
    let result = await supabase
      .from("transactions")
      .delete()
      .eq("user_id", connection.user_id)
      .eq("source", "pluggy")
      .eq("user_edited", false)
      .in("pluggy_transaction_id", chunk)
      .select("id");
    if (result.error && isMissingSchemaError(result.error)) {
      result = await supabase
        .from("transactions")
        .delete()
        .eq("user_id", connection.user_id)
        .eq("source", "pluggy")
        .in("pluggy_transaction_id", chunk)
        .select("id");
    }
    if (result.error) {
      console.error("Erro ao remover transações apagadas na Pluggy:", result.error);
      continue;
    }
    removed += result.data?.length ?? 0;
  }
  return removed;
}

const INVESTMENT_TYPE_LABELS: Record<string, string> = {
  FIXED_INCOME: "Renda Fixa",
  SECURITY: "Previdência",
  MUTUAL_FUND: "Fundo",
  EQUITY: "Renda variável",
  ETF: "ETF",
  COE: "COE",
  OTHER: "Investimento",
  CDB: "CDB",
  LCI: "LCI",
  LCA: "LCA",
  LC: "LC",
  LF: "LF",
  TREASURY: "Tesouro",
  CRI: "CRI",
  CRA: "CRA",
  DEBENTURES: "Debênture",
  CORPORATE_DEBT: "Debênture",
};

function investmentLabel(type?: string, subtype?: string | null, name?: string | null) {
  const haystack = `${name ?? ""} ${subtype ?? ""} ${type ?? ""}`.toUpperCase();
  if (haystack.includes("LCI")) return "LCI";
  if (haystack.includes("LCA")) return "LCA";
  if (haystack.includes("LCD")) return "LCD";
  if (/\bCDB\b/.test(haystack)) return "CDB";
  if (haystack.includes("TESOURO")) return "Tesouro";
  if (subtype && INVESTMENT_TYPE_LABELS[subtype]) return INVESTMENT_TYPE_LABELS[subtype];
  if (type && INVESTMENT_TYPE_LABELS[type]) return INVESTMENT_TYPE_LABELS[type];
  return type || "Investimento";
}

function isInvestmentLikeAccount(account: PluggyAccount) {
  if (account.type === "INVESTMENT") return true;
  const haystack = `${account.name ?? ""} ${account.marketingName ?? ""} ${account.subtype ?? ""}`;
  return /\b(lci|lca|cdb|lcd|cri|cra|tesouro|deb[eê]nture|renda\s*fixa)\b/i.test(haystack);
}

function accountTypeLabel(subtype?: string) {
  if (subtype === "SAVINGS_ACCOUNT") return "poupanca";
  return "corrente";
}

function pluggyAccountName(account: { name?: string; marketingName?: string | null; number?: string | null }) {
  const raw = account.marketingName || account.name || "Conta";
  const cleaned = raw
    .replace(/\bCP\b/gi, " ")
    .replace(/conta\s*principal/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const base = cleaned || "Conta";
  const digits = account.number?.replace(/\D/g, "") ?? "";
  const last4 = digits.length >= 4 ? digits.slice(-4) : null;
  if (last4 && !base.includes(last4)) return `${base} • ${last4}`;
  return base;
}

function monthlyRate(inv: PluggyInvestment): number | null {
  if (inv.lastMonthRate != null && Number(inv.lastMonthRate) !== 0) return Number(inv.lastMonthRate);
  const share = Number(inv.rate);
  const isCdi = /cdi/i.test(inv.rateType ?? "") || share > 40;
  if (Number.isFinite(share) && share > 0 && isCdi) {
    return Number(((CDI_ANNUAL_FALLBACK * share) / 100 / 12).toFixed(4));
  }
  if (inv.lastTwelveMonthsRate != null && Number(inv.lastTwelveMonthsRate) !== 0) {
    const yearly = Number(inv.lastTwelveMonthsRate);
    if (yearly > 0 && yearly <= 40) return yearly / 12;
  }
  const annual = Number(inv.annualRate ?? inv.fixedAnnualRate);
  if (annual > 40 && annual <= 200) {
    return Number(((CDI_ANNUAL_FALLBACK * annual) / 100 / 12).toFixed(4));
  }
  if (annual > 0 && annual <= 40) return annual / 12;
  return null;
}

function investmentStartDays(inv: PluggyInvestment): number {
  const raw = inv.purchaseDate || inv.date;
  if (!raw) return 1;
  const start = new Date(`${toSaoPauloDateOnly(raw)}T12:00:00`);
  const today = new Date();
  const diff = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  return Number.isFinite(diff) ? Math.max(1, diff) : 1;
}

function positionForStorage(inv: PluggyInvestment) {
  const position = resolvePluggyPosition(inv);
  const monthly = monthlyRate(inv);
  const originalMarked = position.original;
  if (originalMarked != null && Math.abs(position.current - originalMarked) >= 0.02) {
    return {
      current: position.current,
      original: originalMarked,
      profit: position.profit ?? Number((position.current - originalMarked).toFixed(2)),
      monthly,
    };
  }
  const original = position.original ?? position.current;
  if (!original || monthly == null) {
    return { current: position.current, original: position.original, profit: position.profit, monthly };
  }
  const profit = Number((original * (monthly / 100) * (investmentStartDays(inv) / 30)).toFixed(2));
  return {
    current: Number((original + profit).toFixed(2)),
    original,
    profit,
    monthly,
  };
}

function investmentInstitution(
  inv: {
    name?: string;
    issuer?: string | null;
    issuerCNPJ?: string | null;
    code?: string | null;
    number?: string | null;
    institution?: { name?: string | null; number?: string | null; cnpj?: string | null } | null;
  },
  connectorName: string,
  accountsFallback: string | null,
  itemFallback: string,
) {
  const inferred = inferInstitutionName(
    [
      inv.institution?.name,
      inv.issuer,
      inv.issuerCNPJ,
      inv.institution?.cnpj,
      inv.name,
      inv.institution?.number,
      inv.code,
      inv.number,
    ],
    "",
  );
  if (inferred) return inferred;
  if (isGenericConnectorName(connectorName)) return "";
  return accountsFallback ?? itemFallback;
}

export type SyncOptions = {
  /**
   * Importar investimentos também (dezenas de chamadas à Pluggy). Webhooks
   * só de transações/saldo pulam essa parte para o push sair na hora.
   */
  investments?: boolean;
};

export async function syncBankConnection(
  supabase: SupabaseClient,
  userId: string,
  bankConnectionId: string,
  pluggyItemId: string,
  options: SyncOptions = {},
) {
  const includeInvestments = options.investments !== false;
  const { data: connectionState } = await supabase
    .from("bank_connections")
    .select("last_synced_at")
    .eq("id", bankConnectionId)
    .single();
  const shouldNotify = Boolean(connectionState?.last_synced_at);
  const newMovements: MovementNotice[] = [];
  const investmentMovements: MovementNotice[] = [];
  const syncedAccountIds: string[] = [];
  const syncedCardIds: string[] = [];

  const item = await pluggyApi.waitForItemIdle(pluggyItemId);
  const { results: accounts } = await pluggyApi.fetchAccounts(pluggyItemId);
  const onlyBank = singleInstitutionFromAccounts(accounts);
  const todaySnapshotDate = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  const institutionName = inferInstitutionName(
    [
      ...accounts.map((a) => a.marketingName),
      ...accounts.map((a) => a.name),
      ...accounts.map((a) => a.bankData?.transferNumber),
    ],
    isGenericConnectorName(item.connector.name) ? "Banco conectado" : item.connector.name,
  );

  for (const account of accounts) {
    const institution = institutionForAccount(account, institutionName);
    const rawName = pluggyAccountName(account);

    if (account.type === "BANK" && !isInvestmentLikeAccount(account)) {
      const { data: accountRow } = await supabase
        .from("accounts")
        .upsert(
          {
            user_id: userId,
            name: withInstitutionPrefix(rawName, institution),
            type: accountTypeLabel(account.subtype),
            balance: account.balance,
            pluggy_account_id: account.id,
            bank_connection_id: bankConnectionId,
            source: "pluggy",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "pluggy_account_id" },
        )
        .select("id")
        .single();

      if (accountRow?.id) syncedAccountIds.push(accountRow.id);
      const created = await syncTransactionsForAccount(supabase, userId, account.id, accountRow?.id ?? null, null);
      newMovements.push(...created);

      if (accountRow?.id) {
        const { error: snapshotError } = await supabase.from("account_balance_snapshots").upsert(
          {
            user_id: userId,
            account_id: accountRow.id,
            bank_connection_id: bankConnectionId,
            snapshot_date: todaySnapshotDate,
            balance: account.balance,
          },
          { onConflict: "account_id,snapshot_date" },
        );
        if (snapshotError) console.error("Erro ao gravar snapshot de saldo:", snapshotError);
      }
    } else if (account.type === "CREDIT") {
      const credit = account.creditData;
      const { data: cardRow } = await supabase
        .from("cards")
        .upsert(
          {
            user_id: userId,
            name: withInstitutionPrefix(rawName, institution),
            credit_limit: credit?.creditLimit ?? null,
            closing_day: credit?.balanceCloseDate ? new Date(credit.balanceCloseDate).getDate() : null,
            due_day: credit?.balanceDueDate ? new Date(credit.balanceDueDate).getDate() : null,
            current_invoice: account.balance,
            pluggy_account_id: account.id,
            bank_connection_id: bankConnectionId,
            source: "pluggy",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "pluggy_account_id" },
        )
        .select("id")
        .single();

      if (cardRow?.id) syncedCardIds.push(cardRow.id);
      const created = await syncTransactionsForAccount(supabase, userId, account.id, null, cardRow?.id ?? null);
      newMovements.push(...created);
    }
  }

  // Provisórios (das notificações do celular) que a Pluggy já devia ter
  // trazido e não casaram com nenhum oficial: saem, para não contar em dobro.
  try {
    await cleanupStaleProvisional(
      supabase,
      userId,
      { accountIds: syncedAccountIds, cardIds: syncedCardIds },
      item.lastUpdatedAt,
    );
  } catch (error) {
    console.error("Erro ao limpar provisórios antigos:", error);
  }

  // Avisa das movimentações do banco AGORA — antes o push só saía no fim,
  // depois de toda a importação de investimentos (muitas chamadas à Pluggy).
  const bankDisplayName = officialInstitutionName(institutionName);
  if (shouldNotify && newMovements.length > 0) {
    try {
      await notifyBankMovements(userId, bankDisplayName, recentMovements(newMovements));
    } catch (error) {
      console.error("Erro ao enviar notificações de movimentação:", error);
    }
  }

  if (includeInvestments) {
    try {
      const connectorBank = bankFromLabel(item.connector.name);
      let { results: investments, complete: investmentsComplete } = await pluggyApi.fetchInvestments(pluggyItemId);
      if (investments.length === 0 && item.status === "UPDATING") {
        await new Promise((resolve) => setTimeout(resolve, 8000));
        ({ results: investments, complete: investmentsComplete } = await pluggyApi.fetchInvestments(pluggyItemId));
      }

      const syntheticIds = new Set<string>();
      const fromAccounts: PluggyInvestment[] = accounts.filter(isInvestmentLikeAccount).map((account) => {
        syntheticIds.add(account.id);
        const label = `${account.marketingName || account.name || "Investimento"}`;
        return {
          id: account.id,
          name: label,
          type: "FIXED_INCOME",
          subtype: investmentLabel("FIXED_INCOME", null, label),
          balance: account.balance,
          amount: account.balance,
          institution: { name: institutionForAccount(account, institutionName) },
          status: "ACTIVE",
        };
      });

      const merged = [...investments];
      if (merged.length === 0) {
        merged.push(...fromAccounts);
      }

      const active = merged
        .filter((inv) => inv.status !== "TOTAL_WITHDRAWAL")
        .filter((inv) => pluggyInvestmentAmount(inv) !== 0 || merged.length === 1);

      const detailedActive = await Promise.all(
        active.map(async (inv) => {
          if (syntheticIds.has(inv.id)) return inv;
          try {
            const extra = await pluggyApi.fetchInvestment(inv.id);
            return { ...inv, ...extra, id: inv.id };
          } catch {
            return inv;
          }
        }),
      );
      if (item.statusDetail?.investments && item.statusDetail.investments.isUpdated === false) {
        console.warn("Pluggy não atualizou investimentos neste sync:", item.statusDetail.investments);
      }

      if (detailedActive.length > 0) {
        const rows = detailedActive.map((inv) => {
          const bank = investmentInstitution(inv, item.connector.name, connectorBank ?? onlyBank, institutionName);
          const position = positionForStorage(inv);
          return {
            user_id: userId,
            name: withInstitutionPrefix(inv.name || "Investimento", bank),
            amount: position.current,
            type: investmentLabel(inv.type, inv.subtype, inv.name),
            amount_profit: position.profit,
            amount_original: position.original,
            last_month_rate: position.monthly == null ? null : Number(position.monthly),
            pluggy_investment_id: inv.id,
            bank_connection_id: bankConnectionId,
            source: "pluggy" as const,
            updated_at: new Date().toISOString(),
          };
        });
        const { error } = await supabase
          .from("investments")
          .upsert(rows, { onConflict: "pluggy_investment_id" });
        if (error) throw error;

        // Só apaga investimentos "sumidos" quando a lista da Pluggy veio
        // completa: uma falha parcial apagava investimentos (e, em cascata,
        // todo o histórico deles) que só não tinham vindo desta vez.
        const keepIds = new Set(active.map((inv) => inv.id));
        const { data: existingInvestments } = await supabase
          .from("investments")
          .select("id, pluggy_investment_id")
          .eq("bank_connection_id", bankConnectionId)
          .eq("source", "pluggy");
        const staleIds = (existingInvestments ?? [])
          .filter((row) => {
            const pluggyId = row.pluggy_investment_id as string | null;
            if (!pluggyId || keepIds.has(pluggyId)) return false;
            if (pluggyId.startsWith("bank-tx:")) return false;
            return true;
          })
          .map((row) => row.id as string);
        if (!investmentsComplete && staleIds.length > 0) {
          console.warn("Lista de investimentos da Pluggy incompleta; limpeza adiada.", staleIds.length);
        } else if (staleIds.length > 0) {
          const { error: pruneError } = await supabase.from("investments").delete().in("id", staleIds);
          if (pruneError) console.error("Erro ao limpar investimentos desatualizados:", pruneError);
        }

        const { data: localRows } = await supabase
          .from("investments")
          .select("id, pluggy_investment_id")
          .eq("bank_connection_id", bankConnectionId);
        const idByPluggy = new Map(
          (localRows ?? []).map((row) => [row.pluggy_investment_id as string, row.id as string]),
        );
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

        const snapshots = detailedActive.flatMap((inv) => {
          const localId = idByPluggy.get(inv.id);
          if (!localId) return [];
          const position = positionForStorage(inv);
          return [
            {
              user_id: userId,
              investment_id: localId,
              bank_connection_id: bankConnectionId,
              snapshot_date: today,
              amount: position.current,
              amount_profit: position.profit,
            },
          ];
        });
        if (snapshots.length > 0) {
          const { error: snapshotError } = await supabase
            .from("investment_snapshots")
            .upsert(snapshots, { onConflict: "investment_id,snapshot_date" });
          if (snapshotError) console.error("Erro ao gravar snapshot de investimentos:", snapshotError);
        }

        for (const inv of detailedActive) {
          if (syntheticIds.has(inv.id)) continue;
          const localId = idByPluggy.get(inv.id);
          if (!localId) continue;
          try {
            const txs = await pluggyApi.fetchInvestmentTransactions(inv.id);
            const txRows = txs.map((transaction) => {
              const raw = Number(transaction.amount ?? 0);
              const type = transaction.type || "OTHER";
              const signed =
                type === "INTEREST"
                  ? Math.abs(raw)
                  : type === "SELL" || type === "TAX"
                    ? -Math.abs(raw)
                    : type === "BUY"
                      ? Math.abs(raw)
                      : transaction.movementType === "DEBIT"
                        ? -Math.abs(raw)
                        : raw;
              return {
                user_id: userId,
                investment_id: localId,
                bank_connection_id: bankConnectionId,
                pluggy_transaction_id: transaction.id,
                type,
                amount: signed,
                date: toSaoPauloDateOnly(transaction.date),
                description: transaction.description,
              };
            });
            const position = positionForStorage(inv);
            const start = inv.purchaseDate || inv.date;
            if (start && position.original) {
              txRows.push({
                user_id: userId,
                investment_id: localId,
                bank_connection_id: bankConnectionId,
                pluggy_transaction_id: `purchase:${inv.id}`,
                type: "BUY",
                amount: position.original,
                date: toSaoPauloDateOnly(start),
                description: "Aplicação",
              });
            }
            if (txRows.length === 0) continue;
            const ids = txRows.map((row) => row.pluggy_transaction_id).filter(Boolean) as string[];
            const already = await knownPluggyIds(supabase, "investment_transactions", ids);
            // Novas: "insere se não existir" + select devolve só o que entrou
            // de fato — com dois syncs ao mesmo tempo, só um avisa.
            const freshRows = txRows.filter((row) => !already.has(row.pluggy_transaction_id));
            const knownRows = txRows.filter((row) => already.has(row.pluggy_transaction_id));
            let insertedIds = new Set<string>();
            if (freshRows.length > 0) {
              const { data: insertedRows, error: insertError } = await supabase
                .from("investment_transactions")
                .upsert(freshRows, { onConflict: "pluggy_transaction_id", ignoreDuplicates: true })
                .select("pluggy_transaction_id");
              if (insertError) console.error("Erro ao gravar movimentações de investimento:", insertError);
              insertedIds = new Set((insertedRows ?? []).map((row) => row.pluggy_transaction_id as string));
            }
            if (knownRows.length > 0) {
              await supabase.from("investment_transactions").upsert(knownRows, {
                onConflict: "pluggy_transaction_id",
              });
            }
            investmentMovements.push(
              ...txRows
                .filter((row) => insertedIds.has(row.pluggy_transaction_id))
                .filter((row) => !String(row.pluggy_transaction_id).startsWith("purchase:"))
                .filter((row) => isRecentMovementDate(row.date))
                .map((row) => ({
                  description: row.description || (row.type === "INTEREST" ? "Rendimento" : row.type === "BUY" ? "Aplicação" : row.type === "SELL" ? "Resgate" : "Investimento"),
                  amount: Math.abs(Number(row.amount)),
                  type: Number(row.amount) >= 0 && row.type !== "BUY" ? "entrada" : "saida",
                  date: row.date,
                })),
            );
          } catch (txError) {
            console.error("Erro ao importar movimentações do investimento:", txError);
          }
        }
      }

      const withdrawnIds = investments
        .filter((inv) => inv.status === "TOTAL_WITHDRAWAL")
        .map((inv) => inv.id);
      if (withdrawnIds.length > 0) {
        const { error: cleanupError } = await supabase
          .from("investments")
          .delete()
          .eq("bank_connection_id", bankConnectionId)
          .eq("source", "pluggy")
          .in("pluggy_investment_id", withdrawnIds);
        if (cleanupError) {
          console.error("Erro ao limpar investimentos encerrados da Pluggy:", cleanupError);
        }
      }
    } catch (error) {
      console.error("Erro ao importar investimentos da Pluggy:", error);
    }
  }

  await supabase
    .from("bank_connections")
    .update({
      institution_name: institutionName,
      institution_image_url: item.connector.imageUrl ?? null,
      status: item.status,
      // Junto com o statusDetail, a hora real dos dados e a próxima atualização
      // da Pluggy (ver lib/finance/connection-freshness.ts).
      status_detail: JSON.stringify({
        ...(item.statusDetail ?? {}),
        dataUpdatedAt: item.lastUpdatedAt ?? null,
        nextAutoSyncAt: item.nextAutoSyncAt ?? null,
      }),
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", bankConnectionId);

  // Filtrado pelo dono: no cron/webhook o cliente é admin e ignora RLS.
  const [{ data: dbAccounts }, { data: dbInvestments }] = await Promise.all([
    supabase.from("accounts").select("*").eq("user_id", userId),
    supabase.from("investments").select("*").eq("user_id", userId),
  ]);
  try {
    await promoteInvestmentsFromTransactions(
      supabase,
      (dbAccounts ?? []) as Account[],
      (dbInvestments ?? []) as Investment[],
      userId,
    );
  } catch (error) {
    console.error("Erro ao reconciliar investimentos do extrato:", error);
  }
  const freshInvestmentMovements = recentMovements(investmentMovements);
  if (shouldNotify && freshInvestmentMovements.length > 0) {
    try {
      await notifyBankMovements(userId, bankDisplayName, freshInvestmentMovements);
    } catch (error) {
      console.error("Erro ao enviar notificações de investimentos:", error);
    }
  }
}


const SYNC_LOCK_MS = 4 * 60 * 1000;
const MAX_SYNC_ROUNDS = 3;

/**
 * "acquired": esta execução é a dona da trava (token = o valor gravado em
 * sync_lock_until, usado para liberar só a própria trava).
 * "busy": outro sync está rodando. "unsupported": migration 0010 ausente.
 */
type Lock = { state: "acquired"; token: string } | { state: "busy" } | { state: "unsupported" };

async function acquireSyncLock(supabase: SupabaseClient, bankConnectionId: string): Promise<Lock> {
  const now = new Date();
  const token = new Date(now.getTime() + SYNC_LOCK_MS).toISOString();
  const { data, error } = await supabase
    .from("bank_connections")
    .update({ sync_lock_until: token, sync_pending: false })
    .eq("id", bankConnectionId)
    .or(`sync_lock_until.is.null,sync_lock_until.lt."${now.toISOString()}"`)
    .select("id");
  if (error) {
    if (!isMissingSchemaError(error)) console.error("Erro ao travar sync da conexão:", error);
    return { state: "unsupported" };
  }
  return data && data.length > 0 ? { state: "acquired", token } : { state: "busy" };
}

/** Libera a trava só se ainda for nossa; devolve se chegou pedido "pendente" no meio-tempo. */
async function releaseSyncLock(supabase: SupabaseClient, bankConnectionId: string, token: string): Promise<boolean> {
  const { data } = await supabase
    .from("bank_connections")
    .update({ sync_lock_until: null })
    .eq("id", bankConnectionId)
    .eq("sync_lock_until", token)
    .select("sync_pending")
    .maybeSingle();
  return Boolean(data?.sync_pending);
}

/**
 * Marca "pendente" só se a trava ainda estiver ativa (numa única
 * instrução). Se o sync em andamento acabou de liberar, devolve false e
 * quem pediu tenta travar de novo — assim nenhum pedido se perde.
 */
async function markSyncPending(supabase: SupabaseClient, bankConnectionId: string): Promise<boolean> {
  const { data } = await supabase
    .from("bank_connections")
    .update({ sync_pending: true })
    .eq("id", bankConnectionId)
    .gt("sync_lock_until", new Date().toISOString())
    .select("id");
  return Boolean(data && data.length > 0);
}

/**
 * Sync com trava por conexão. A Pluggy manda vários webhooks quase juntos
 * (item/updated, transactions/created...) e cada um rodava um sync completo
 * em paralelo. Agora, se já há um sync rodando, o pedido só marca
 * "pendente" e o sync em andamento roda mais uma rodada no fim — nada se
 * perde e nada roda em dobro.
 */
export async function syncBankConnectionSafely(
  supabase: SupabaseClient,
  userId: string,
  bankConnectionId: string,
  pluggyItemId: string,
  options: SyncOptions = {},
): Promise<"synced" | "queued"> {
  let lock = await acquireSyncLock(supabase, bankConnectionId);
  if (lock.state === "busy") {
    if (await markSyncPending(supabase, bankConnectionId)) return "queued";
    // A trava foi liberada entre as duas consultas: tenta de novo.
    lock = await acquireSyncLock(supabase, bankConnectionId);
    if (lock.state === "busy" && (await markSyncPending(supabase, bankConnectionId))) return "queued";
  }

  let roundOptions = options;
  for (let round = 0; round < MAX_SYNC_ROUNDS; round += 1) {
    let failure: unknown = null;
    try {
      await syncBankConnection(supabase, userId, bankConnectionId, pluggyItemId, roundOptions);
    } catch (error) {
      failure = error ?? new Error("Falha no sync");
    }
    if (lock.state === "acquired") {
      const pending = await releaseSyncLock(supabase, bankConnectionId, lock.token);
      // Chegou aviso novo enquanto sincronizava: roda de novo (só o
      // essencial) para pegar os dados que chegaram nesse meio-tempo.
      const again = pending && !failure && round < MAX_SYNC_ROUNDS - 1;
      lock = again ? await acquireSyncLock(supabase, bankConnectionId) : { state: "busy" };
    }
    if (failure) throw failure;
    if (lock.state !== "acquired") break;
    roundOptions = { ...options, investments: false };
  }
  return "synced";
}
