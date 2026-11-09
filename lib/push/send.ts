import * as webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVapidKeys, vapidSubject } from "./vapid";
import { movementPayloads, recentMovements, type MovementNotice, type PushPayload } from "./payload";
import { signPushAction } from "./actions";
import { CATEGORIES, CATEGORY_ICONS } from "@/lib/finance/categories";

type SubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushUrgency = "very-low" | "low" | "normal" | "high";

export type SendResult = {
  /** Inscrições (aparelhos) cadastradas para o usuário. */
  subscriptions: number;
  /** Entregues ao serviço de push do navegador. */
  delivered: number;
  /** Falhas (qualquer motivo, exceto inscrição inexistente). */
  failed: number;
  /** Falhas temporárias — sem resposta, 429 ou 5xx: vale tentar de novo depois. */
  transient: number;
};

function isTransientStatus(status: number | undefined): boolean {
  return status == null || status === 429 || status >= 500;
}

/**
 * - urgency "high": sem isso o Android (modo Doze) pode segurar a notificação
 *   por muito tempo com a tela desligada. Movimentações do banco vão como
 *   "high"; alertas e resumos, como "normal".
 * - TTL: por quanto tempo o serviço de push guarda a mensagem se o aparelho
 *   estiver offline (depois disso ela é descartada, em vez de chegar velha).
 */
async function sendOne(
  keys: { publicKey: string; privateKey: string },
  row: SubscriptionRow,
  payload: PushPayload,
  urgency: PushUrgency,
) {
  await webpush.sendNotification(
    {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    },
    JSON.stringify(payload),
    {
      vapidDetails: { subject: vapidSubject(), publicKey: keys.publicKey, privateKey: keys.privateKey },
      urgency,
      TTL: urgency === "high" ? 6 * 60 * 60 : 24 * 60 * 60,
      timeout: 15_000,
    },
  );
}

const FALLBACK_CATEGORIES = ["Alimentação", "Transporte", "Compras", "Moradia", "Lazer", "Saúde"];
const NOT_SUGGESTED = new Set(["Outros", "Salário", "Investimentos", "Dívidas"]);

/** Categorias de gasto que o usuário mais usa (últimos 90 dias) — viram os botões do push. */
async function topSpendingCategories(userId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("transactions")
    .select("category")
    .eq("user_id", userId)
    .eq("type", "saida")
    .gte("date", since)
    .order("date", { ascending: false })
    .limit(1000);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const category = row.category as string;
    if (!category || NOT_SUGGESTED.has(category) || !CATEGORIES.includes(category as never)) continue;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([category]) => category);
  for (const category of FALLBACK_CATEGORIES) if (!ranked.includes(category)) ranked.push(category);
  return ranked.slice(0, 4);
}

/**
 * Push de movimentação bancária. Cada gasto (quando vem um por notificação)
 * leva 2 botões com as categorias mais usadas — o Android mostra no máximo
 * 2 — para categorizar sem abrir o app. Tocar na notificação abre a tela
 * de escolher qualquer outra categoria.
 */
export async function notifyBankMovements(userId: string, bankName: string, movements: MovementNotice[]) {
  const fresh = recentMovements(movements);
  const payloads = movementPayloads(bankName, fresh);
  if (payloads.length === 0) return;
  // Uma notificação por movimentação (até 6); acima disso vira um resumo sem botões.
  const oneEach = payloads.length === fresh.length;

  let suggestions: string[] | null = null;
  for (let index = 0; index < payloads.length; index += 1) {
    let payload = payloads[index];
    const item = oneEach ? fresh[index] : null;
    if (item?.id && item.type === "saida") {
      suggestions ??= await topSpendingCategories(userId).catch(() => FALLBACK_CATEGORIES);
      const options = suggestions.filter((category) => category !== item.category).slice(0, 2);
      const token = signPushAction({ k: "tx", u: userId, t: item.id });
      if (token && options.length > 0) {
        payload = {
          ...payload,
          actions: options.map((category) => ({
            action: `cat:${category}`,
            title: `${CATEGORY_ICONS[category] ?? ""} ${category}`.trim(),
          })),
          actionToken: token,
        };
      }
    }
    await sendPushToUser(userId, payload, "high");
  }
}

/**
 * Envia uma notificação push para todas as inscrições ativas de um usuário
 * (movimentações bancárias, alertas inteligentes e resumo semanal).
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  urgency: PushUrgency = "normal",
): Promise<SendResult> {
  const result: SendResult = { subscriptions: 0, delivered: 0, failed: 0, transient: 0 };
  const keys = await getVapidKeys();
  if (!keys) return result;

  const supabase = createAdminClient();
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subscriptions || subscriptions.length === 0) return result;
  result.subscriptions = subscriptions.length;

  await Promise.all(
    (subscriptions as SubscriptionRow[]).map(async (row) => {
      try {
        await sendOne(keys, row, payload, urgency);
        result.delivered += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404/410: inscrição não existe mais (app desinstalado, permissão
        // revogada). Remove para não tentar de novo.
        if (status === 404 || status === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", row.id);
          return;
        }
        result.failed += 1;
        if (isTransientStatus(status)) result.transient += 1;
        console.error("Erro ao enviar notificação push:", status ?? "", error);
      }
    }),
  );
  return result;
}
