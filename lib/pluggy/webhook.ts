import { createHash, timingSafeEqual } from "node:crypto";
import { pluggyApi } from "./client";

export const WEBHOOK_TOKEN_HEADER = "x-financeiro-webhook-token";
const ENSURE_INTERVAL_MS = 6 * 60 * 60 * 1000;

let lastEnsured: { url: string; at: number } | null = null;

/**
 * Segredo enviado pela Pluggy num cabeçalho em cada webhook de aplicação.
 * Usa PLUGGY_WEBHOOK_SECRET se existir; senão deriva do BANK_CRON_SECRET
 * (que já está configurado), sem expor o segredo do cron em si.
 */
export function webhookSecret(): string | null {
  const explicit = process.env.PLUGGY_WEBHOOK_SECRET;
  if (explicit) return explicit;
  const cron = process.env.BANK_CRON_SECRET;
  if (!cron) return null;
  return createHash("sha256").update(`pluggy-webhook:${cron}`).digest("hex");
}

export function webhookUrlFor(origin: string | null): string | undefined {
  return origin ? `${origin}/api/bank/webhook` : undefined;
}

/**
 * "valid": veio do webhook de aplicação com o segredo certo.
 * "missing": sem cabeçalho (webhook por item, que não suporta cabeçalho).
 * "invalid": cabeçalho com valor errado — recusado.
 */
export function verifyWebhookToken(request: Request): "valid" | "missing" | "invalid" {
  const received = request.headers.get(WEBHOOK_TOKEN_HEADER);
  if (!received) return "missing";
  const secret = webhookSecret();
  if (!secret) return "missing";
  const a = Buffer.from(received);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b) ? "valid" : "invalid";
}

/**
 * Garante um webhook de aplicação ("all") na Pluggy apontando para este app.
 * O webhook por item só é definido quando o banco é conectado (e o Meu
 * Pluggy não aceita atualizar o item), então itens antigos podiam ficar sem
 * webhook — e aí as movimentações só chegavam pelo cron. O de aplicação vale
 * para todos os itens. Roda no cron, no máximo a cada 6 horas.
 */
export async function ensureAppWebhook(url: string | undefined): Promise<string> {
  if (!url || !url.startsWith("https://")) return "skipped";
  if (lastEnsured && lastEnsured.url === url && Date.now() - lastEnsured.at < ENSURE_INTERVAL_MS) {
    return "cached";
  }

  const secret = webhookSecret();
  const headers = secret ? { [WEBHOOK_TOKEN_HEADER]: secret } : undefined;
  const existing = (await pluggyApi.listWebhooks()).find(
    (webhook) => webhook.url === url && webhook.event === "all",
  );

  if (existing) {
    await pluggyApi.updateWebhook(existing.id, { headers: headers ?? null, enabled: true });
  } else {
    await pluggyApi.createWebhook({ event: "all", url, ...(headers ? { headers } : {}) });
  }
  lastEnsured = { url, at: Date.now() };
  return existing ? "updated" : "created";
}
