import * as webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export type VapidKeys = {
  publicKey: string;
  privateKey: string;
};

export async function getVapidKeys(): Promise<VapidKeys | null> {
  const fromEnvPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const fromEnvPrivate = process.env.VAPID_PRIVATE_KEY;
  if (fromEnvPublic && fromEnvPrivate) {
    return { publicKey: fromEnvPublic, privateKey: fromEnvPrivate };
  }

  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("push_vapid_keys").select("public_key, private_key").eq("id", 1).maybeSingle();
    if (data?.public_key && data?.private_key) {
      return { publicKey: data.public_key, privateKey: data.private_key };
    }

    const generated = webpush.generateVAPIDKeys();
    const { error } = await supabase.from("push_vapid_keys").upsert({
      id: 1,
      public_key: generated.publicKey,
      private_key: generated.privateKey,
    });
    if (error) {
      console.error("Não foi possível gravar as chaves VAPID:", error);
      return generated;
    }
    return { publicKey: generated.publicKey, privateKey: generated.privateKey };
  } catch (error) {
    console.error("Erro ao obter chaves VAPID:", error);
    return null;
  }
}

export function vapidSubject() {
  return process.env.VAPID_SUBJECT || "mailto:diego@meu-financeiro-ia.local";
}
