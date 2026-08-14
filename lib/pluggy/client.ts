const PLUGGY_API = "https://api.pluggy.ai";

type JsonMap = Record<string, unknown>;

let cachedApiKey: string | null = null;

async function getApiKey(): Promise<string> {
  if (cachedApiKey) return cachedApiKey;

  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET não estão configurados no servidor.");
  }

  const response = await fetch(`${PLUGGY_API}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });

  const body = (await response.json().catch(() => ({}))) as JsonMap;
  if (!response.ok || typeof body.apiKey !== "string") {
    throw new Error(
      typeof body.message === "string"
        ? body.message
        : `Falha ao autenticar na Pluggy (HTTP ${response.status}).`,
    );
  }

  cachedApiKey = body.apiKey;
  return cachedApiKey;
}

async function pluggyFetch(path: string, init: RequestInit = {}): Promise<JsonMap> {
  const apiKey = await getApiKey();
  const response = await fetch(`${PLUGGY_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
      ...(init.headers ?? {}),
    },
  });

  if (response.status === 204) return {};

  const body = (await response.json().catch(() => ({}))) as JsonMap;
  if (!response.ok) {
    throw new Error(
      typeof body.message === "string"
        ? body.message
        : `Erro na Pluggy (HTTP ${response.status}).`,
    );
  }
  return body;
}

export type PluggyAccount = {
  id: string;
  type: string;
  name?: string;
  balance: number;
  creditData?: {
    creditLimit?: number | null;
    balanceCloseDate?: string | null;
    balanceDueDate?: string | null;
  } | null;
};

export type PluggyItem = {
  id: string;
  status: string;
  statusDetail?: unknown;
  connector: { name: string; imageUrl?: string | null };
};

export type PluggyTransaction = {
  id: string;
  description?: string;
  amount: number;
  type: string;
  category?: string | null;
  date: string;
};

export const pluggyApi = {
  async createConnectToken(options: {
    clientUserId: string;
    webhookUrl?: string;
    avoidDuplicates?: boolean;
  }) {
    const body = await pluggyFetch("/connect_token", {
      method: "POST",
      body: JSON.stringify({ options }),
    });
    if (typeof body.accessToken !== "string") {
      throw new Error("A Pluggy não devolveu um connect token.");
    }
    return { accessToken: body.accessToken };
  },

  async fetchItem(itemId: string) {
    return (await pluggyFetch(`/items/${itemId}`)) as unknown as PluggyItem;
  },

  async fetchAccounts(itemId: string) {
    const body = await pluggyFetch(`/accounts?itemId=${encodeURIComponent(itemId)}`);
    return { results: (body.results ?? []) as PluggyAccount[] };
  },

  async fetchAllTransactions(accountId: string, dateFrom: string) {
    const transactions: PluggyTransaction[] = [];
    let after: string | null = null;

    for (let i = 0; i < 20; i++) {
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
};
