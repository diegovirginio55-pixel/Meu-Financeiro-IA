import * as webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export type VapidKeys = {
  publicKey: string;
  privateKey: string;
};

let cachedKeys: VapidKeys | null = null;

export async function getVapidKeys(): Promise<VapidKeys | null> {
  const fromEnvPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const fromEnvPrivate = process.env.VAPID_PRIVATE_KEY;
  if (fromEnvPublic && fromEnvPrivate) {
    return { publicKey: fromEnvPublic, privateKey: fromEnvPrivate };
  }

  if (cachedKeys) return cachedKeys;

  try {
    const supabase = createAdminClient();
    const { data, error: readError } = await supabase
      .from("push_vapid_keys")
      .select("public_key, private_key")
      .eq("id", 1)
      .maybeSingle();
    // Falha ao ler NÃO pode gerar chaves novas: isso trocava as chaves e
    // todas as inscrições existentes paravam de receber push em silêncio.
    if (readError) {
      console.error("Erro ao ler chaves VAPID:", readError);
      return null;
    }
    if (data?.public_key && data?.private_key) {
      cachedKeys = { publicKey: data.public_key, privateKey: data.private_key };
      return cachedKeys;
    }

    // Primeira vez: gera e grava sem sobrescrever (se outro processo gravou
    // antes, usa as dele).
    const generated = webpush.generateVAPIDKeys();
    const { error: insertError } = await supabase.from("push_vapid_keys").upsert(
      { id: 1, public_key: generated.publicKey, private_key: generated.privateKey },
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (insertError) {
      console.error("Não foi possível gravar as chaves VAPID:", insertError);
      return null;
    }
    const { data: stored } = await supabase
      .from("push_vapid_keys")
      .select("public_key, private_key")
      .eq("id", 1)
      .maybeSingle();
    if (!stored?.public_key || !stored?.private_key) return null;
    cachedKeys = { publicKey: stored.public_key, privateKey: stored.private_key };
    return cachedKeys;
  } catch (error) {
    console.error("Erro ao obter chaves VAPID:", error);
    return null;
  }
}

export function vapidSubject() {
  return process.env.VAPID_SUBJECT || "mailto:diego@meu-financeiro-ia.local";
}
