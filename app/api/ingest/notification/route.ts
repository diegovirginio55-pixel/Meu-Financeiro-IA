import { createHash } from "node:crypto";
import { after, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyIngestToken } from "@/lib/ingest/token";
import { parseBankNotification, type ParsedBankNotification } from "@/lib/ingest/parse-notification";
import { parseReceipt, type ParsedReceipt } from "@/lib/ingest/parse-receipt";
import { PROVISIONAL_PREFIX } from "@/lib/ingest/provisional";
import {
  applyCategoryRules,
  counterpartyFromDescription,
  inferCategoryFromDescription,
  isGenericCategory,
  isTransferDescription,
  mentionsOwnName,
  TRANSFER_CATEGORY,
  type CategoryRule,
} from "@/lib/finance/categories";
import { incomeCategory } from "@/lib/pluggy/categorize";
import { loadOwnerNames } from "@/lib/finance/owner-names";
import { isValidDateKey } from "@/lib/finance/validation";
import { isInvestmentDescription } from "@/lib/finance/investment-movements";
import { saoPauloTodayKey } from "@/lib/finance/fluxo";
import { bankFromLabel } from "@/lib/pluggy/institution";
import { officialInstitutionName } from "@/lib/pluggy/brands";
import { serverError } from "@/lib/api/errors";
import { appendIngestLog } from "@/lib/ingest/log";
import { recordPhoneStatus } from "@/lib/ingest/phone-status";
import { notifyRealtimeMovement } from "@/lib/push/realtime-movement";

const MAX_BODY_BYTES = 8 * 1024;
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

const MAX_BACKDATE_MS = 3 * 24 * 60 * 60 * 1000;
/** Comprovante pode ser de um Pix de até 60 dias atrás. */
const RECEIPT_MAX_DAYS = 60;
/** Saída numa conta e entrada de mesmo valor em outra dentro disso = transferência entre as próprias contas. */
const PAIR_WINDOW_MS = 30 * 60 * 1000;

/** Pix/TED/transferência (com ou sem nome), inclusive "Recebido de Fulano" dos avisos. */
function isTransferLike(description: string): boolean {
  return isTransferDescription(description) || /^recebido de\b/i.test(description);
}

function shiftDateKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

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
  /** App Android: "receipt" = texto de um comprovante compartilhado do app do banco. */
  kind?: unknown;
  /** App Android: versão do app e se o leitor de notificações está ligado (vão em todo envio). */
  v?: unknown;
  listener?: unknown;
  /** App Android: "estou vivo" periódico — só atualiza o estado, não registra nada. */
  status?: unknown;
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

  const appVersion = str(body.v, 20).trim();
  if (appVersion) {
    await recordPhoneStatus(createAdminClient(), userId, {
      version: appVersion,
      listener: body.listener === true || body.listener === "true",
    });
  }
  if (body.status === true || body.status === "true") {
    return NextResponse.json({ ok: true, status: true });
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

  // Comprovante compartilhado do app do banco (o app Android lê o texto da imagem/PDF no celular).
  const isReceipt = body.kind === "receipt";
  const input = {
    app: withoutMagicText(str(body.app, 120)),
    label: withoutMagicText(str(body.label, 120)),
    title: withoutMagicText(str(body.title, 300)),
    text: withoutMagicText(str(body.text, isReceipt ? 4000 : 1500)),
  };
  const isTest = body.test === true || body.test === "true";
  const logApp = isReceipt ? "Comprovante" : input.label || input.app;
  const preview = (
    isReceipt ? `Comprovante — ${input.text.replace(/\s+/g, " ")}` : `${input.title ? `${input.title} — ` : ""}${input.text}`
  ).slice(0, 120);
  const result = isReceipt ? parseReceipt(input.text) : parseBankNotification(input);
  if (!result.ok) {
    const detail = !isReceipt && result.reason === "notificação vazia" ? emptyReason(body) : result.reason;
    if (!isTest) await appendIngestLog(userId, { app: logApp, preview, result: "ignorado", detail });
    return NextResponse.json({ ok: true, ignored: result.reason });
  }
  const parsed: ParsedBankNotification | ParsedReceipt = result.parsed;
  const receipt = isReceipt ? (result.parsed as ParsedReceipt) : null;

  const supabase = createAdminClient();
  const [connectionsRes, accountsRes, cardsRes, rulesRes, ownerNames] = await Promise.all([
    supabase.from("bank_connections").select("id, institution_name").eq("user_id", userId),
    supabase.from("accounts").select("id, name, bank_connection_id, source").eq("user_id", userId),
    supabase.from("cards").select("id, name, bank_connection_id, source").eq("user_id", userId),
    supabase.from("category_rules").select("pattern, category").eq("user_id", userId),
    loadOwnerNames(supabase, userId),
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

  // Pix/transferência para o próprio nome (ex.: "Recebido de DIEGO …") só troca dinheiro de lugar.
  const rules = (rulesRes.data ?? []) as CategoryRule[];
  const ruleCategory = applyCategoryRules(parsed.description, rules);
  const counterparty = counterpartyFromDescription(parsed.description);
  const ownTransfer = counterparty != null && mentionsOwnName(counterparty, ownerNames);
  let category =
    ruleCategory ??
    (ownTransfer ? TRANSFER_CATEGORY : null) ??
    (isInvestmentDescription(parsed.description) ? "Investimentos" : null) ??
    inferCategoryFromDescription(parsed.description) ??
    (parsed.type === "entrada" ? incomeCategory(parsed.description) : "Outros");

  // Comprovante de outro dia (até 60 dias): entra na data do pagamento.
  const todayKey = saoPauloTodayKey(noticeTime(body.at));
  const date =
    receipt?.date && isValidDateKey(receipt.date) && receipt.date <= todayKey && receipt.date >= shiftDateKey(todayKey, -RECEIPT_MAX_DAYS)
      ? receipt.date
      : todayKey;

  const row = {
    user_id: userId,
    description: parsed.description,
    amount: parsed.amount,
    type: parsed.type,
    category,
    date,
    account_id: card ? null : (account?.id ?? null),
    card_id: card?.id ?? null,
    source: "manual" as const,
    pluggy_transaction_id: "",
  };

  if (isTest) {
    return NextResponse.json({ ok: true, test: true, wouldRegister: { ...row, user_id: undefined, pluggy_transaction_id: undefined, bank: parsed.bank } });
  }

  const movement = { description: row.description, amount: row.amount, type: row.type, category, bank: parsed.bank };
  const target = card ? "cartão" : account ? "conta" : "sem conta vinculada";

  // Comprovante de algo que já está no app (pelo aviso do banco ou pelo Meu Pluggy): não duplica.
  if (receipt) {
    let query = supabase
      .from("transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("type", row.type)
      .eq("amount", row.amount)
      .gte("date", shiftDateKey(date, -1))
      .lte("date", shiftDateKey(date, 1));
    if (row.account_id) query = query.eq("account_id", row.account_id);
    const { data: same } = await query.limit(1);
    if ((same ?? []).length > 0) {
      await appendIngestLog(userId, {
        app: logApp,
        preview,
        result: "duplicado",
        detail: `Já estava no app: R$ ${row.amount.toFixed(2).replace(".", ",")} · ${row.description}`,
      });
      return NextResponse.json({ ok: true, registered: false, movement });
    }
  }

  // Pix entre duas contas do usuário sem nome no aviso ("Pix enviado" num banco e "Pix recebido"
  // no outro, mesmo valor, poucos minutos): os dois viram transferência.
  let pairedId: string | null = null;
  if (!ruleCategory && category !== TRANSFER_CATEGORY && isTransferLike(row.description)) {
    const { data: candidates } = await supabase
      .from("transactions")
      .select("id, account_id, category, description")
      .eq("user_id", userId)
      .like("pluggy_transaction_id", `${PROVISIONAL_PREFIX}%`)
      .eq("type", row.type === "entrada" ? "saida" : "entrada")
      .eq("amount", row.amount)
      .gte("created_at", new Date(Date.now() - PAIR_WINDOW_MS).toISOString())
      .limit(5);
    const pair = (candidates ?? []).find(
      (item) => item.account_id !== row.account_id && isGenericCategory(item.category) && isTransferLike(String(item.description)),
    );
    if (pair) {
      pairedId = pair.id as string;
      category = TRANSFER_CATEGORY;
      row.category = category;
      movement.category = category;
    }
  }

  // A mesma notificação repetida (o celular às vezes reenvia) não duplica.
  // O app Android manda um id próprio do aviso, que vale mesmo num reenvio horas depois;
  // no comprovante, o identificador do Pix.
  const clientId = receipt
    ? receipt.transactionId
      ? `pix:${receipt.transactionId}`
      : `comprovante:${createHash("sha256").update(input.text).digest("hex").slice(0, 24)}`
    : str(body.id, 100).trim();
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
  const insertedId = (data ?? [])[0]?.id as string | undefined;
  if (registered && pairedId) {
    const { error: pairError } = await supabase.from("transactions").update({ category: TRANSFER_CATEGORY }).eq("id", pairedId);
    if (pairError) console.error("Erro ao marcar o par da transferência:", pairError);
  }
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
    app: logApp,
    preview,
    result: registered ? "registrado" : "duplicado",
    detail: `${row.type === "entrada" ? "Entrada" : "Saída"} de R$ ${row.amount.toFixed(2).replace(".", ",")} · ${row.description} · ${category} · ${parsed.bank ?? "banco não identificado"} (${target})`,
  });

  return NextResponse.json({ ok: true, registered, movement });
}
