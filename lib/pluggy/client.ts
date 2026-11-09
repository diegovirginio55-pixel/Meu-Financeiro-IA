const PLUGGY_API = "https://api.pluggy.ai";

type JsonMap = Record<string, unknown>;

/**
 * A apiKey da Pluggy expira em 2 horas. Antes ela ficava guardada para
 * sempre: como o cron mantém o servidor acordado, depois de ~2h todas as
 * chamadas falhavam (sync e notificações paravam) até o servidor reiniciar.
 * Agora ela é renovada antes de vencer e, se a Pluggy recusar (401/403),
 * é descartada e a chamada é repetida uma vez com uma chave nova.
 */
const API_KEY_TTL_MS = 100 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 25_000;

let cachedApiKey: { value: string; expiresAt: number } | null = null;
let pendingApiKey: Promise<string> | null = null;

export class PluggyError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PluggyError";
  }
}

async function requestApiKey(): Promise<string> {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET não estão configurados no servidor.");
  }

  const response = await fetch(`${PLUGGY_API}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const body = (await response.json().catch(() => ({}))) as JsonMap;
  if (!response.ok || typeof body.apiKey !== "string") {
    throw new PluggyError(
      typeof body.message === "string"
        ? body.message
        : `Falha ao autenticar na Pluggy (HTTP ${response.status}).`,
      response.status,
    );
  }

  cachedApiKey = { value: body.apiKey, expiresAt: Date.now() + API_KEY_TTL_MS };
  return body.apiKey;
}

async function getApiKey(): Promise<string> {
  if (cachedApiKey && cachedApiKey.expiresAt > Date.now()) return cachedApiKey.value;
  // Várias chamadas simultâneas compartilham a mesma autenticação.
  pendingApiKey ??= requestApiKey().finally(() => {
    pendingApiKey = null;
  });
  return pendingApiKey;
}

async function pluggyFetch(path: string, init: RequestInit = {}, retried = false): Promise<JsonMap> {
  const apiKey = await getApiKey();
  const response = await fetch(`${PLUGGY_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
      ...(init.headers ?? {}),
    },
    signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if ((response.status === 401 || response.status === 403) && !retried) {
    cachedApiKey = null;
    return pluggyFetch(path, init, true);
  }

  if (response.status === 204) return {};

  const body = (await response.json().catch(() => ({}))) as JsonMap;
  if (!response.ok) {
    throw new PluggyError(
      typeof body.message === "string"
        ? body.message
        : `Erro na Pluggy (HTTP ${response.status}).`,
      response.status,
    );
  }
  return body;
}

export type PluggyAccount = {
  id: string;
  type: string;
  subtype?: string;
  name?: string;
  marketingName?: string | null;
  number?: string | null;
  balance: number;
  bankData?: {
    transferNumber?: string | null;
  } | null;
  creditData?: {
    creditLimit?: number | null;
    balanceCloseDate?: string | null;
    balanceDueDate?: string | null;
  } | null;
};

export type PluggyItem = {
  id: string;
  status: string;
  executionStatus?: string | null;
  statusDetail?: {
    investments?: { isUpdated?: boolean; lastUpdatedAt?: string | null; warnings?: unknown[] } | null;
    accounts?: { isUpdated?: boolean; lastUpdatedAt?: string | null } | null;
  } | null;
  connector: { name: string; imageUrl?: string | null };
  clientUserId?: string | null;
};

export type PluggyTransaction = {
  id: string;
  description?: string;
  amount: number;
  type: string;
  category?: string | null;
  date: string;
};

export type PluggyInvestment = {
  id: string;
  name?: string;
  type?: string;
  subtype?: string | null;
  balance?: number | null;
  amount?: number | null;
  amountProfit?: number | null;
  amountOriginal?: number | null;
  lastMonthRate?: number | null;
  lastTwelveMonthsRate?: number | null;
  status?: string;
  issuer?: string | null;
  issuerCNPJ?: string | null;
  code?: string | null;
  number?: string | null;
  value?: number | null;
  quantity?: number | null;
  taxes?: number | null;
  taxes2?: number | null;
  rate?: number | null;
  rateType?: string | null;
  annualRate?: number | null;
  fixedAnnualRate?: number | null;
  purchaseDate?: string | null;
  date?: string | null;
  institution?: { name?: string | null; number?: string | null; cnpj?: string | null } | null;
};

function finiteMoney(value: unknown): number | null {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0) return null;
  return amount;
}

function nearlyEqual(left: number, right: number, tolerance = 0.02) {
  return Math.abs(left - right) < tolerance;
}

export type PluggyPosition = {
  current: number;
  original: number | null;
  profit: number | null;
};

/**
 * Inter lista o valor bruto atual (LCI 12.043,70 + LCD 5.119,94).
 * No Open Finance a Pluggy às vezes manda `amount` = valor aplicado e `balance` = líquido.
 */
export function resolvePluggyPosition(inv: PluggyInvestment): PluggyPosition {
  const original = finiteMoney(inv.amountOriginal);
  const amount = finiteMoney(inv.amount);
  const balance = finiteMoney(inv.balance);
  const profitRaw = Number(inv.amountProfit);
  const profit =
    inv.amountProfit == null || !Number.isFinite(profitRaw) || profitRaw === 0 ? null : profitRaw;
  const taxes = Math.abs(Number(inv.taxes) || 0) + Math.abs(Number(inv.taxes2) || 0);
  const quantityValue =
    inv.quantity != null && inv.value != null ? Number(inv.quantity) * Number(inv.value) : NaN;
  const fromQuantity = Number.isFinite(quantityValue) && quantityValue !== 0 ? Number(quantityValue.toFixed(2)) : null;

  const amountIsPrincipal =
    (amount != null && original != null && nearlyEqual(amount, original)) ||
    (amount != null && original == null && balance != null && amount < balance - 0.005);

  let current: number | null = null;
  if (amount != null && !amountIsPrincipal) current = amount;
  else if (balance != null && taxes > 0) current = Number((balance + taxes).toFixed(2));
  else if (fromQuantity != null && (original == null || !nearlyEqual(fromQuantity, original))) current = fromQuantity;
  else if (original != null && profit != null) current = Number((original + profit).toFixed(2));
  else if (amount != null && amountIsPrincipal && profit != null) current = Number((amount + profit).toFixed(2));
  else if (balance != null) current = balance;
  else if (fromQuantity != null) current = fromQuantity;
  else if (amount != null) current = amount;
  else if (original != null) current = original;
  else current = 0;

  const resolvedOriginal =
    original ??
    (amountIsPrincipal ? amount : null) ??
    (amount != null && current > amount + 0.005 ? amount : null);

  const resolvedProfit =
    resolvedOriginal != null && current !== 0
      ? Number((current - resolvedOriginal).toFixed(2))
      : profit;

  return { current, original: resolvedOriginal, profit: resolvedProfit };
}

/** Valor bruto atual — o mesmo número da lista "Total investido" do Inter. */
export function pluggyInvestmentAmount(inv: PluggyInvestment): number {
  return resolvePluggyPosition(inv).current;
}

export type PluggyInvestmentTransaction = {
  id: string;
  type?: string | null;
  movementType?: string | null;
  description?: string | null;
  amount?: number | null;
  date: string;
};

export const pluggyApi = {
  async createConnectToken(options: {
    clientUserId: string;
    webhookUrl?: string;
    oauthRedirectUri?: string;
    avoidDuplicates?: boolean;
    itemId?: string;
  }) {
    const payload: Record<string, unknown> = {
      options: {
        clientUserId: options.clientUserId,
        webhookUrl: options.webhookUrl,
        oauthRedirectUri: options.oauthRedirectUri,
        avoidDuplicates: options.itemId ? false : (options.avoidDuplicates ?? true),
        products: ["ACCOUNTS", "CREDIT_CARDS", "TRANSACTIONS", "INVESTMENTS"],
      },
    };
    if (options.itemId) payload.itemId = options.itemId;

    const body = await pluggyFetch("/connect_token", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (typeof body.accessToken !== "string") {
      throw new Error("A Pluggy não devolveu um connect token.");
    }
    return { accessToken: body.accessToken };
  },

  async patchItem(itemId: string, payload: Record<string, unknown>) {
    return pluggyFetch(`/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  async waitForItemIdle(itemId: string, timeoutMs = 70000) {
    const started = Date.now();
    let item = await this.fetchItem(itemId);
    while (Date.now() - started < timeoutMs) {
      if (item.status !== "UPDATING") return item;
      await new Promise((resolve) => setTimeout(resolve, 2500));
      item = await this.fetchItem(itemId);
    }
    return item;
  },

  async fetchItem(itemId: string) {
    return (await pluggyFetch(`/items/${itemId}`)) as unknown as PluggyItem;
  },

  async fetchAccounts(itemId: string) {
    const body = await pluggyFetch(`/accounts?itemId=${encodeURIComponent(itemId)}`);
    return { results: (body.results ?? []) as PluggyAccount[] };
  },

  async fetchInvestments(itemId: string) {
    const byId = new Map<string, PluggyInvestment>();
    const types = ["FIXED_INCOME", "MUTUAL_FUND", "EQUITY", "ETF", "SECURITY", "COE", "OTHER"];

    async function collect(type?: string) {
      let page = 1;
      for (let i = 0; i < 20; i++) {
        const params = new URLSearchParams({
          itemId,
          page: String(page),
          pageSize: "50",
        });
        if (type) params.set("type", type);
        const body = await pluggyFetch(`/investments?${params.toString()}`);
        const batch = (body.results ?? []) as PluggyInvestment[];
        batch.forEach((investment) => byId.set(investment.id, investment));
        const totalPages = Number(body.totalPages ?? 1);
        if (page >= totalPages || batch.length < 50) break;
        page += 1;
      }
    }

    // `complete` = todas as consultas responderam. Com lista parcial o sync
    // não pode apagar investimentos "ausentes" (eles só não vieram desta vez).
    let complete = true;
    try {
      await collect();
    } catch (error) {
      complete = false;
      console.error("Erro ao listar investimentos da Pluggy:", error);
    }

    for (const type of types) {
      try {
        await collect(type);
      } catch (error) {
        complete = false;
        console.error(`Erro ao listar investimentos ${type} da Pluggy:`, error);
      }
    }

    return { results: [...byId.values()], complete };
  },

  async fetchInvestment(id: string) {
    return (await pluggyFetch(`/investments/${encodeURIComponent(id)}`)) as unknown as PluggyInvestment;
  },

  async fetchInvestmentTransactions(investmentId: string) {
    const results: PluggyInvestmentTransaction[] = [];
    let page = 1;

    for (let i = 0; i < 20; i++) {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "50",
      });
      const body = await pluggyFetch(
        `/investments/${encodeURIComponent(investmentId)}/transactions?${params.toString()}`,
      );
      results.push(...((body.results ?? []) as PluggyInvestmentTransaction[]));
      const totalPages = Number(body.totalPages ?? 1);
      if (page >= totalPages) break;
      page += 1;
    }

    return results;
  },

  async fetchAllTransactions(accountId: string, dateFrom: string) {
    const transactions: PluggyTransaction[] = [];
    let after: string | null = null;

    for (let i = 0; i < 60; i++) {
      const params = new URLSearchParams({
        accountId,
        dateFrom,
      });
      if (after) params.set("after", after);

      const body = await pluggyFetch(`/v2/transactions?${params.toString()}`);
      const results = (body.results ?? []) as PluggyTransaction[];
      transactions.push(...results);

      const next = typeof body.next === "string" ? body.next : null;
      if (!next) break;
      try {
        after = new URL(next, PLUGGY_API).searchParams.get("after");
      } catch {
        break;
      }
      if (!after) break;
    }

    return transactions;
  },

  async deleteItem(itemId: string) {
    await pluggyFetch(`/items/${itemId}`, { method: "DELETE" });
  },

  /** Webhooks no nível da aplicação (valem para todos os itens). */
  async listWebhooks(): Promise<PluggyWebhook[]> {
    const body = (await pluggyFetch("/webhooks")) as unknown;
    if (Array.isArray(body)) return body as PluggyWebhook[];
    const results = (body as { results?: unknown }).results;
    return Array.isArray(results) ? (results as PluggyWebhook[]) : [];
  },

  async createWebhook(payload: { event: string; url: string; headers?: Record<string, string> }) {
    return (await pluggyFetch("/webhooks", {
      method: "POST",
      body: JSON.stringify(payload),
    })) as unknown as PluggyWebhook;
  },

  async updateWebhook(
    id: string,
    payload: { event?: string; url?: string; headers?: Record<string, string> | null; enabled?: boolean },
  ) {
    return (await pluggyFetch(`/webhooks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    })) as unknown as PluggyWebhook;
  },
};

export type PluggyWebhook = {
  id: string;
  event: string;
  url: string;
  disabledAt?: string | null;
};
