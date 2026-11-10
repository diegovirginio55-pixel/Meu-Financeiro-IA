import { bankFromLabel } from "@/lib/pluggy/institution";

/**
 * Lê a notificação do app do banco no celular (encaminhada pelo MacroDroid
 * no Android ou pelo Atalhos no iPhone) e extrai a movimentação: valor,
 * entrada/saída, cartão ou conta, banco e descrição. Função pura (testável).
 *
 * É heurística: cada banco escreve de um jeito. Na dúvida, ignora — melhor
 * não registrar do que registrar errado (propaganda, limite disponível,
 * compra recusada...). O lançamento é provisório e é trocado pelo oficial
 * quando a Pluggy trouxer os dados do banco.
 */
export type BankNotificationInput = {
  app?: string | null;
  /** Nome do app como aparece no celular (o app Android manda junto com o pacote). */
  label?: string | null;
  title?: string | null;
  text?: string | null;
};

export type ParsedBankNotification = {
  amount: number;
  type: "entrada" | "saida";
  kind: "card" | "account";
  bank: string | null;
  description: string;
};

export type ParseResult = { ok: true; parsed: ParsedBankNotification } | { ok: false; reason: string };

/** Pacotes Android dos apps de banco mais comuns → nome oficial usado no app. */
const PACKAGE_BANKS: Record<string, string> = {
  "com.nu.production": "Nubank",
  "br.com.intermedium": "Inter",
  "br.com.gabba.caixa": "Caixa",
  "br.gov.caixa.tem": "Caixa",
  "br.gov.caixa.cartoes": "Caixa",
  "com.bradesco": "Bradesco",
  "br.com.bradesco.next": "Bradesco",
  "com.santander.app": "Santander",
  "com.itau": "Itaú",
  "com.itau.iti": "Itaú",
  "br.com.bb.android": "Banco do Brasil",
  "com.c6bank.app": "C6 Bank",
  "com.picpay": "PicPay",
  "com.mercadopago.wallet": "Mercado Pago",
  "br.com.sicoobnet": "Sicoob",
  "br.com.sicoob.moob": "Sicoob",
  "br.com.neon": "Neon",
  "br.com.uol.ps.myaccount": "PagBank",
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** "1.234,56" / "45,90" / "12.50" → número. */
function parseAmount(raw: string): number | null {
  const cleaned = raw.trim();
  const value = cleaned.includes(",")
    ? Number(cleaned.replace(/\./g, "").replace(",", "."))
    : Number(cleaned);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
}

const DECLINED = /(recusad|negad|nao autorizad|nao aprovad|cancelad|nao concluid|falhou|bloquead)/;
const INCOME = /(voce recebeu|recebeu|recebid|deposito|depositad|credito em conta|creditad|estorno|estornad|reembols|salario|rendimento)/;
const EXPENSE =
  /(compra|pagamento|pagou|pago\b|pix enviado|voce enviou|enviou|enviad|transferencia realizada|transferiu|debito|debitad|saque|tarifa|boleto)/;
const CARD = /(cartao|credito|fatura)/;

function cleanMerchant(value: string): string {
  return value
    .replace(/\s+(?:para o cart|no cart|do cart|com final|final \d|foi |as \d|às \d|em \d{2}\/|no dia|hoje\b).*$/i, "")
    .replace(/["“”]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function describe(original: string, type: "entrada" | "saida", amountIndex: number): string | null {
  // Procura depois do valor (ex.: "Compra de R$ 45,90 em IFOOD").
  const after = original.slice(Math.max(0, amountIndex));
  const merchant = /\b(?:em|no estabelecimento|na loja)\s+(?!R\$)([^\n.;!]+)/i.exec(after);
  if (merchant) {
    const name = cleanMerchant(merchant[1]);
    if (name && !/^\d/.test(name)) return name;
  }
  const to = /\bpara\s+(?!R\$|o cart|seu cart|sua conta)([^\n.;!]+)/i.exec(after);
  if (to && type === "saida") {
    const name = cleanMerchant(to[1]);
    if (name) return `Pix para ${name}`;
  }
  const from = /\bde\s+(?!R\$)([A-ZÀ-Ú][^\n.;!]+)/.exec(after);
  if (from && type === "entrada") {
    const name = cleanMerchant(from[1]);
    if (name) return `Recebido de ${name}`;
  }
  // SMS de banco costuma pôr o estabelecimento ANTES do valor ("... em PADARIA, R$ 10,00").
  if (type === "saida") {
    const before = original.slice(0, Math.max(0, amountIndex));
    const shop = /\b(?:em|no estabelecimento|na loja)\s+(?!R\$|seu |sua |\d)([^\n.;!,]+)/i.exec(before);
    if (shop) {
      const name = cleanMerchant(shop[1]);
      if (name) return name;
    }
  }
  return null;
}

/** Título que é só o nome do banco (ex.: remetente "CAIXA" do SMS) não serve de descrição. */
function isOnlyBankName(title: string): boolean {
  return title.length <= 24 && bankFromLabel(title) != null && !/\b(compra|pix|pagamento|transfer|saque|dep[oó]sito)/i.test(title);
}

export function bankFromNotification(input: BankNotificationInput): string | null {
  const app = (input.app ?? "").trim();
  const byPackage = PACKAGE_BANKS[app.toLowerCase()];
  if (byPackage) return byPackage;
  return (
    bankFromLabel(input.label ?? "") ??
    bankFromLabel(app) ??
    bankFromLabel(input.title ?? "") ??
    bankFromLabel(input.text ?? "")
  );
}

export function parseBankNotification(input: BankNotificationInput): ParseResult {
  const title = (input.title ?? "").trim();
  const text = (input.text ?? "").trim();
  const original = [title, text].filter(Boolean).join("\n");
  if (!original) return { ok: false, reason: "notificação vazia" };
  const plain = normalize(original);

  if (DECLINED.test(plain)) return { ok: false, reason: "movimentação recusada ou cancelada" };

  const amountMatch = /R\$\s*-?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+(?:\.\d{1,2})?)/.exec(original);
  if (!amountMatch) return { ok: false, reason: "sem valor em reais" };
  const amount = parseAmount(amountMatch[1]);
  if (amount == null) return { ok: false, reason: "valor inválido" };

  let type: "entrada" | "saida" | null = null;
  if (INCOME.test(plain)) type = "entrada";
  else if (EXPENSE.test(plain)) type = "saida";
  if (!type) return { ok: false, reason: "não parece uma movimentação (propaganda, limite, aviso)" };

  const isPix = /\bpix\b/.test(plain);
  // "Compra no cartão de DÉBITO" sai da conta, não da fatura do cartão de crédito.
  const isDebit = /\bdebito\b/.test(plain) && !/\bcredito\b/.test(plain);
  const kind: "card" | "account" =
    !isPix && !isDebit && CARD.test(plain) && !/credito em conta|creditad/.test(plain) ? "card" : "account";

  const bank = bankFromNotification(input);
  const description =
    describe(original, type, amountMatch.index) ??
    (title && !/R\$/.test(title) && !isOnlyBankName(title) ? title.slice(0, 80) : null) ??
    `${type === "entrada" ? "Entrada" : "Saída"}${bank ? ` ${bank}` : ""}`;

  return { ok: true, parsed: { amount, type, kind, bank, description } };
}
