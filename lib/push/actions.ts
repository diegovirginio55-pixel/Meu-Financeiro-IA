import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { BillKind } from "@/lib/finance/bill-reminders";

/**
 * Ações direto na notificação (botões do push). Cada notificação leva um
 * token assinado pelo servidor que diz exatamente o que aquele botão pode
 * fazer — categorizar UM lançamento, ou marcar UMA conta como paga. Assim
 * o botão funciona sem abrir o app (e sem depender da sessão do navegador),
 * e ninguém consegue forjar uma ação para outro lançamento.
 */
export type PushActionClaim =
  | { k: "tx"; u: string; t: string }
  | { k: "bill"; u: string; b: BillKind; r: string; d: string };

type SignedClaim = PushActionClaim & { e: number };

const DEFAULT_TTL_DAYS = 10;

function secret(): string | null {
  const explicit = process.env.PUSH_ACTION_SECRET;
  if (explicit) return explicit;
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.BANK_CRON_SECRET;
  if (!base) return null;
  return createHash("sha256").update(`push-action:${base}`).digest("hex");
}

function signature(body: string, key: string): string {
  return createHmac("sha256", key).update(body).digest("base64url");
}

/** Token para os botões da notificação; null se o servidor não tiver segredo configurado. */
export function signPushAction(claim: PushActionClaim, ttlDays = DEFAULT_TTL_DAYS): string | null {
  const key = secret();
  if (!key) return null;
  const payload: SignedClaim = { ...claim, e: Date.now() + ttlDays * 86_400_000 };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${signature(body, key)}`;
}

export function verifyPushAction(token: unknown): PushActionClaim | null {
  if (typeof token !== "string" || token.length > 2000) return null;
  const key = secret();
  if (!key) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(signature(body, key));
  const received = Buffer.from(sig);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const claim = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SignedClaim;
    if (typeof claim.e !== "number" || claim.e < Date.now()) return null;
    if (claim.k === "tx" && typeof claim.u === "string" && typeof claim.t === "string") {
      return { k: "tx", u: claim.u, t: claim.t };
    }
    if (
      claim.k === "bill" &&
      typeof claim.u === "string" &&
      typeof claim.r === "string" &&
      typeof claim.d === "string" &&
      (claim.b === "recurring" || claim.b === "debt" || claim.b === "card")
    ) {
      return { k: "bill", u: claim.u, b: claim.b, r: claim.r, d: claim.d };
    }
    return null;
  } catch {
    return null;
  }
}
