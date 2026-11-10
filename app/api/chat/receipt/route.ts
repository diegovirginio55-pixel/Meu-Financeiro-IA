import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { genAI, GEMINI_MODEL } from "@/lib/ai/gemini";
import { geminiRetryAt, getQuotaView, isGeminiQuotaError, lockQuota } from "@/lib/ai/quota";
import { readChatQuota, writeChatQuota } from "@/lib/ai/quota-cookie";
import { formatCurrency } from "@/lib/finance/format";
import { saoPauloTodayKey } from "@/lib/finance/fluxo";

export const maxDuration = 60;

const MAX_BYTES = 6 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_BYTES + 64 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

type Receipt = {
  isReceipt?: boolean;
  amount?: number | string | null;
  merchant?: string | null;
  date?: string | null;
  payment?: string | null;
  type?: string | null;
};

const PROMPT = `Você lê comprovantes brasileiros (nota fiscal, cupom, recibo, comprovante de Pix, boleto pago, maquininha).
Responda SOMENTE um JSON com:
{"isReceipt": boolean, "amount": número em reais (total pago, ex.: 45.9), "merchant": "nome curto da loja ou de quem recebeu o Pix", "date": "AAAA-MM-DD" ou null, "payment": "credito" | "debito" | "pix" | "dinheiro" | "boleto" | null, "type": "saida" | "entrada"}
Use o VALOR TOTAL (não subtotais nem troco). "entrada" só se for um Pix/transferência RECEBIDO. Se a imagem não for um comprovante com valor, responda {"isReceipt": false}.`;

function parseAmount(value: Receipt["amount"]): number | null {
  const amount = typeof value === "string" ? Number(value.replace(/\./g, "").replace(",", ".")) : Number(value);
  return Number.isFinite(amount) && amount > 0 && amount < 1_000_000 ? Math.round(amount * 100) / 100 : null;
}

/** "2026-11-10" → "10/11" (se for de hoje, "hoje"). */
function dateLabel(date: string | null | undefined): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (date === saoPauloTodayKey()) return "hoje";
  return `no dia ${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

const PAYMENT_LABEL: Record<string, string> = {
  credito: "no cartão de crédito",
  debito: "no débito",
  pix: "no Pix",
  dinheiro: "em dinheiro",
  boleto: "no boleto",
};

/**
 * Foto do comprovante → frase pronta para o chat ("Gastei R$ 45,90 no
 * IFOOD hoje no cartão de crédito"). O usuário confere e envia; quem
 * registra é a IA do chat, como em qualquer mensagem.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_REQUEST_BYTES) return NextResponse.json({ error: "Foto grande demais." }, { status: 413 });

  const quotaState = await readChatQuota(supabase, userData.user.id);
  const quota = getQuotaView(quotaState);
  if (quota.limited) return NextResponse.json({ error: quota.label, quota }, { status: 429 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Foto vazia." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Foto grande demais." }, { status: 413 });
  const mimeType = (file.type || "image/jpeg").toLowerCase();
  if (!IMAGE_TYPES.has(mimeType)) return NextResponse.json({ error: "Formato de imagem não suportado." }, { status: 415 });

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const response = await genAI.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: buffer.toString("base64") } }, { text: PROMPT }] }],
      config: { responseMimeType: "application/json", temperature: 0 },
    });

    let receipt: Receipt = {};
    try {
      receipt = JSON.parse((response.text ?? "{}").trim()) as Receipt;
    } catch {
      receipt = {};
    }
    const amount = parseAmount(receipt.amount);
    if (!receipt.isReceipt || amount === null) {
      return NextResponse.json({ error: "Não achei o valor nessa foto. Tente uma foto mais nítida do comprovante.", quota }, { status: 422 });
    }

    const merchant = (receipt.merchant ?? "").toString().trim().slice(0, 60);
    const income = receipt.type === "entrada";
    const parts = [
      income ? `Recebi ${formatCurrency(amount)}` : `Gastei ${formatCurrency(amount)}`,
      merchant ? (income ? `de ${merchant}` : `em ${merchant}`) : null,
      dateLabel(receipt.date),
      receipt.payment ? PAYMENT_LABEL[receipt.payment] ?? null : null,
    ].filter(Boolean);

    return NextResponse.json({ text: parts.join(" "), quota });
  } catch (error) {
    if (isGeminiQuotaError(error)) {
      const locked = lockQuota(quotaState, geminiRetryAt(error));
      const nextQuota = getQuotaView(locked);
      await writeChatQuota(supabase, userData.user.id, locked);
      return NextResponse.json({ error: nextQuota.label, quota: nextQuota }, { status: 429 });
    }
    console.error("Erro ao ler comprovante:", error);
    return NextResponse.json({ error: "Não deu para ler a foto. Tente de novo." }, { status: 500 });
  }
}
