import { createHash } from "node:crypto";
import { after, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyIngestToken } from "@/lib/ingest/token";
import { parseBankNotification } from "@/lib/ingest/parse-notification";
import { PROVISIONAL_PREFIX } from "@/lib/ingest/provisional";
import { applyCategoryRules, inferCategoryFromDescription, type CategoryRule } from "@/lib/finance/categories";
import { isInvestmentDescription } from "@/lib/finance/investment-movements";
import { saoPauloTodayKey } from "@/lib/finance/fluxo";
import { bankFromLabel } from "@/lib/pluggy/institution";
import { officialInstitutionName } from "@/lib/pluggy/brands";
import { serverError } from "@/lib/api/errors";
import { appendIngestLog } from "@/lib/ingest/log";
import { notifyRealtimeMovement } from "@/lib/push/realtime-movement";

const MAX_BODY_BYTES = 8 * 1024;
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

const MAX_BACKDATE_MS = 3 * 24 * 60 * 60 * 1000;

type Body = {
  token?: unknown;
  app?: unknown;
  /** App Android: nome do app como aparece no celular (ex.: "Cartões CAIXA"). */
  label?: unknown;
  title?: unknown;
  text?: unknown;
  test?: unknown;
  /** App Android: botão "Enviar teste" (só registra no log que a conexão funciona). */
  ping?: unknown;
  /** App Android: identificador do aviso — reenvios do mesmo aviso não duplicam. */
  id?: unknown;
  /** App Android: hora em que o aviso apareceu (ms) — um reenvio atrasado cai no dia certo. */
  at?: unknown;
};

/** Hora do aviso informada pelo celular, se for plausível (até 3 dias atrás); senão, agora. */
function noticeTime(value: unknown): Date {
  const ms = typeof value === "number" ? value : Number(value);
  const now = Date.now();
  return Number.isFinite(ms) && ms > now - MAX_BACKDATE_MS && ms <= now + 5 * 60 * 1000 ? new Date(ms) : new Date(now);
}

function str(value: unknown, max = 1000): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

const MAGIC_TEXT = /^\s*[\[{][a-z_ ]+[\]}]\s*$/i;

/** Campo do MacroDroid que não foi substituído (ex.: "[app_name]" literal): trata como vazio. */
function withoutMagicText(value: string): string {
  return MAGIC_TEXT.test(value) ? "" : value;
}

/** Explica no registro por que um aviso sem conteúdo chegou — para o usuário saber se está tudo certo. */
function emptyReason(body: Body): string {
  const fields = [body.app, body.title, body.text];
  if (fields.every((value) => value === undefined)) {
    return "chegou sem o corpo — no MacroDroid, confira a aba Corpo/Conteúdo (application/json)";
  }
  if (fields.some((value) => typeof value === "string" && MAGIC_TEXT.test(value)) || fields.every((value) => value === "")) {
    return "teste sem notificação real — a conexão está funcionando ✓";
  }
  return "notificação vazia";
}

/** Aceita JSON ou formulário (o MacroDroid e o Atalhos mandam dos dois jeitos). */
async function readBody(request: Request): Promise<Body | null> {
  const raw = await request.text().catch(() => "");
  if (!raw || raw.length > MAX_BODY_BYTES) return raw ? null : {};
  try {
    return JSON.parse(raw) as Body;
  } catch {
    return Object.fromEntries(new URLSearchParams(raw)) as Body;
  }
}

/**
 * Recebe a notificação do app do banco encaminhada pelo celular e registra
 * a movimentação na hora, como provisória. Quando a Pluggy trouxer o
 * lançamento oficial, o provisório é trocado por ele (ver
 * lib/ingest/provisional.ts). Sem login: autorizado pelo token pessoal
 * (no corpo, no cabeçalho Authorization ou em ?token=).
 */
export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ error: "Notificação grande demais." }, { status: 413 });

  const body = await readBody(request);
  if (!body) return NextResponse.json({ error: "Notificação grande demais." }, { status: 413 });

  const url = new URL(request.url);
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const userId = await verifyIngestToken(body.token ?? bearer ?? url.searchParams.get("token"));
  if (!userId) {
    return NextResponse.json({ error: "Token inválido. Gere um novo em Bancos → Saldo em tempo real." }, { status: 401 });
  }

  if (body.ping === true || body.ping === "true") {
    await appendIngestLog(userId, {
      app: "App Android",
      preview: "",
      result: "teste",
      detail: "Teste do app Android: conexão funcionando ✓",
    });
    return NextResponse.json({ ok: true, ping: true });
  }

  const input = {
    app: withoutMagicText(str(body.app, 120)),
    label: withoutMagicText(str(body.label, 120)),
    title: withoutMagicText(str(body.title, 300)),
    text: withoutMagicText(str(body.text, 1500)),
  };
  const isTest = body.test === true || body.test === "true";
  const preview = `${input.title ? `${input.title} — ` : ""}${input.text}`.slice(0, 120);
  const result = parseBankNotification(input);
  if (!result.ok) {
    const detail = result.reason === "notificação vazia" ? emptyReason(body) : result.reason;
    if (!isTest) await appendIngestLog(userId, { app: input.label || input.app, preview, result: "ignorado", detail });
    return NextResponse.json({ ok: true, ignored: result.reason });
  }
  const parsed = result.parsed;

  const supabase = createAdminClient();
  const [connectionsRes, accountsRes, cardsRes, rulesRes] = await Promise.all([
    supabase.from("bank_connections").select("id, institution_name").eq("user_id", userId),
    supabase.from("accounts").select("id, name, bank_connection_id, source").eq("user_id", userId),
    supabase.from("cards").select("id, name, bank_connection_id, source").eq("user_id", userId),
    supabase.from("category_rules").select("pattern, category").eq("user_id", userId),
  ]);
  const connections = connectionsRes.data ?? [];
  const bankOf = (row: { name: string; bank_connection_id: string | null }) => {
    const byName = bankFromLabel(row.name);
    if (byName) return byName;
    const connection = connections.find((item) => item.id === row.bank_connection_id);
    return connection ? officialInstitutionName(connection.institution_name) : null;
  };
  const sameBank = <T extends { name: string; bank_connection_id: string | null }>(rows: T[]) =>
    parsed.bank ? rows.filter((row) => bankOf(row) === parsed.bank) : [];

  const card = parsed.kind === "card" ? sameBank(cardsRes.data ?? [])[0] : undefined;
  const account = parsed.kind === "account" || !card ? sameBank(accountsRes.data ?? [])[0] : undefined;

  const rules = (rulesRes.data ?? []) as CategoryRule[];
  const category =
    applyCategoryRules(parsed.description, rules) ??
    (isInvestmentDescription(parsed.description) ? "Investimentos" : null) ??
    inferCategoryFromDescription(parsed.description) ??
    (parsed.type === "entrada" ? "Salário" : "Outros");

  const row = {
    user_id: userId,
    description: parsed.description,
    amount: parsed.amount,
    type: parsed.type,
    category,
    date: saoPauloTodayKey(noticeTime(body.at)),
    account_id: card ? null : (account?.id ?? null),
    card_id: card?.id ?? null,
    source: "manual" as const,
    pluggy_transaction_id: "",
  };

  if (isTest) {
    return NextResponse.json({ ok: true, test: true, wouldRegister: { ...row, user_id: undefined, pluggy_transaction_id: undefined, bank: parsed.bank } });
  }

  // A mesma notificação repetida (o celular às vezes reenvia) não duplica.
  // O app Android manda um id próprio do aviso, que vale mesmo num reenvio horas depois.
  const clientId = str(body.id, 100).trim();
  const bucket = Math.floor(Date.now() / DEDUPE_WINDOW_MS);
  const fingerprint = createHash("sha256")
    .update(
      (clientId
        ? [userId, "id", clientId]
        : [userId, parsed.bank, parsed.type, parsed.amount, input.title, input.text, bucket]
      ).join("|"),
    )
    .digest("hex")
    .slice(0, 24);
  row.pluggy_transaction_id = `${PROVISIONAL_PREFIX}${fingerprint}`;

  const { data, error } = await supabase
    .from("transactions")
    .upsert(row, { onConflict: "pluggy_transaction_id", ignoreDuplicates: true })
    .select("id");
  if (error) return serverError("Não foi possível registrar a notificação.", error);

  const registered = (data ?? []).length > 0;
  const target = card ? "cartão" : account ? "conta" : "sem conta vinculada";
  const insertedId = (data ?? [])[0]?.id as string | undefined;
  if (registered && insertedId) {
    // Depois de responder ao celular: aviso na hora (saldo novo + limite de hoje) e alertas de controle.
    after(() =>
      notifyRealtimeMovement(supabase, userId, {
        id: insertedId,
        description: row.description,
        amount: row.amount,
        type: row.type,
        category,
        bank: parsed.bank,
        accountId: row.account_id,
      }),
    );
  }
  await appendIngestLog(userId, {
    app: input.label || input.app,
    preview,
    result: registered ? "registrado" : "duplicado",
    detail: `${row.type === "entrada" ? "Entrada" : "Saída"} de R$ ${row.amount.toFixed(2).replace(".", ",")} · ${row.description} · ${category} · ${parsed.bank ?? "banco não identificado"} (${target})`,
  });

  return NextResponse.json({
    ok: true,
    registered: (data ?? []).length > 0,
    movement: { description: row.description, amount: row.amount, type: row.type, category, bank: parsed.bank },
  });
}
