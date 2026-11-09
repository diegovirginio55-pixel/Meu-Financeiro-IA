import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Token pessoal para o celular (MacroDroid / Atalhos) enviar as notificações
 * do banco ao app, sem login. Formato: mfi_<userId>_<versão>_<assinatura>.
 * A versão fica em internal_settings (só o servidor lê): "Gerar novo token"
 * aumenta a versão e o token antigo para de funcionar na hora.
 */
const PREFIX = "mfi";

function secret(): string | null {
  const explicit = process.env.PUSH_ACTION_SECRET;
  const base = explicit || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.BANK_CRON_SECRET;
  if (!base) return null;
  return createHash("sha256").update(`ingest-token:${base}`).digest("hex");
}

function sign(userId: string, version: number, key: string): string {
  return createHmac("sha256", key).update(`${userId}:${version}`).digest("base64url").slice(0, 32);
}

const versionKey = (userId: string) => `ingest_version:${userId}`;

async function currentVersion(userId: string): Promise<number> {
  const { data, error } = await createAdminClient()
    .from("internal_settings")
    .select("value")
    .eq("key", versionKey(userId))
    .maybeSingle();
  if (error || !data) return 1;
  const version = Number.parseInt(String(data.value), 10);
  return Number.isFinite(version) && version > 0 ? version : 1;
}

export async function ingestTokenFor(userId: string): Promise<string | null> {
  const key = secret();
  if (!key) return null;
  const version = await currentVersion(userId);
  return `${PREFIX}_${userId}_${version}_${sign(userId, version, key)}`;
}

/** Gera um token novo (o anterior deixa de funcionar). */
export async function rotateIngestToken(userId: string): Promise<string | null> {
  const key = secret();
  if (!key) return null;
  const next = (await currentVersion(userId)) + 1;
  const { error } = await createAdminClient()
    .from("internal_settings")
    .upsert({ key: versionKey(userId), value: String(next), updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) {
    console.error("Erro ao trocar o token de notificações:", error);
    return null;
  }
  return `${PREFIX}_${userId}_${next}_${sign(userId, next, key)}`;
}

/** Devolve o id do usuário dono do token, ou null se inválido/antigo. */
export async function verifyIngestToken(token: unknown): Promise<string | null> {
  if (typeof token !== "string" || token.length > 200) return null;
  const key = secret();
  if (!key) return null;
  const match = /^mfi_([0-9a-f-]{36})_(\d+)_([A-Za-z0-9_-]{32})$/.exec(token.trim());
  if (!match) return null;
  const [, userId, versionText, signature] = match;
  const version = Number(versionText);
  const expected = Buffer.from(sign(userId, version, key));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  if (version !== (await currentVersion(userId))) return null;
  return userId;
}
