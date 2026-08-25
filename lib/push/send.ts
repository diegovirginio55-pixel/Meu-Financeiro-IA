import * as webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVapidKeys, vapidSubject } from "./vapid";
import { movementPayloads, recentMovements, type MovementNotice, type PushPayload } from "./payload";

type SubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

async function sendOne(keys: { publicKey: string; privateKey: string }, row: SubscriptionRow, payload: PushPayload) {
  webpush.setVapidDetails(vapidSubject(), keys.publicKey, keys.privateKey);
  await webpush.sendNotification(
    {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    },
    JSON.stringify(payload),
  );
}

export async function notifyBankMovements(userId: string, bankName: string, movements: MovementNotice[]) {
  const payloads = movementPayloads(bankName, recentMovements(movements));
  if (payloads.length === 0) return;

  const keys = await getVapidKeys();
  if (!keys) return;

  const supabase = createAdminClient();
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subscriptions || subscriptions.length === 0) return;

  for (const payload of payloads) {
    await Promise.all(
      (subscriptions as SubscriptionRow[]).map(async (row) => {
        try {
          await sendOne(keys, row, payload);
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", row.id);
            return;
          }
          console.error("Erro ao enviar notificação push:", error);
        }
      }),
    );
  }
}
