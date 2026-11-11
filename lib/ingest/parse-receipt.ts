import { bankFromCnpj, bankFromLabel } from "@/lib/pluggy/institution";

/**
 * Comprovante de Pix/transferência compartilhado do app do banco (o app
 * Android lê o texto da imagem/PDF no próprio celular). Cobre o Pix que o
 * banco não avisa por notificação — quando a própria pessoa faz o Pix com o
 * app aberto. Função pura.
 *
 * O texto chega em linhas, cada uma com o rótulo e o valor lado a lado
 * ("Nome Izoleide Mangueira da Cruz"), como o comprovante aparece na tela.
 */
export type ParsedReceipt = {
  amount: number;
  type: "entrada" | "saida";
  kind: "account";
  bank: string | null;
  description: string;
  /** Data do pagamento ("YYYY-MM-DD"), se o comprovante mostrar. */
  date: string | null;
  /** Identificador do Pix (E2E), se legível: o mesmo comprovante duas vezes não duplica. */
  transactionId: string | null;
};

export type ReceiptResult = { ok: true; parsed: ParsedReceipt } | { ok: false; reason: string };

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function parseAmount(raw: string): number | null {
  const value = Number(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
}

const MONEY = /R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/i;
const LOOKS_LIKE_RECEIPT =
  /comprovante|pix (enviado|recebido|realizado|agendado)|transferencia (enviada|recebida|realizada)|pagamento (realizado|efetuado)|quem (recebeu|pagou)|\bdestino\b|favorecido|recebedor|beneficiario/;
const INCOMING = /pix recebido|transferencia recebida|voce recebeu|recebimento de pix|comprovante de recebimento/;

const RECEIVER_MARK = /^(quem recebeu|destino|dados do recebedor|dados de quem recebeu|recebedor|favorecido|beneficiario|para)\b/;
const PAYER_MARK = /^(quem pagou|origem|dados do pagador|dados de quem pagou|pagador|de)\b/;
const LABEL_WORDS =
  /\b(cpf|cnpj|instituicao|banco|agencia|conta|chave|tipo|valor|data|horario|hora|id|autenticacao|transacao|documento|pix|nome)\b/;

type Section = { start: number; end: number };

function findSection(lines: string[], mark: RegExp, other: RegExp): Section | null {
  const start = lines.findIndex((line) => mark.test(normalize(line)));
  if (start < 0) return null;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (other.test(normalize(lines[index]))) {
      end = index;
      break;
    }
  }
  return { start, end };
}

function cleanValue(value: string): string {
  return value.replace(/^[:\s-]+/, "").replace(/\s+/g, " ").trim();
}

/** "Nome Fulano" → "Fulano"; sem a linha "Nome", a primeira linha que parece nome de pessoa/empresa. */
function nameIn(lines: string[], section: Section, mark: RegExp): string | null {
  for (let index = section.start; index < section.end; index += 1) {
    const plain = normalize(lines[index]);
    const match = plain.match(/^nome( completo)?\b/);
    if (match) {
      const rest = cleanValue(lines[index].slice(match[0].length));
      if (rest) return rest;
      const next = lines[index + 1];
      if (next && index + 1 < section.end) return cleanValue(next);
    }
  }
  for (let index = section.start; index < section.end; index += 1) {
    // Na linha do título ("Destino Fulano"), o nome vem depois do título.
    const marker = index === section.start ? normalize(lines[index]).match(mark) : null;
    const raw = marker ? lines[index].slice(marker[0].length) : lines[index];
    const value = cleanValue(raw);
    const plain = normalize(value);
    if (!value || LABEL_WORDS.test(plain) || /\d{3}/.test(plain)) continue;
    if (/^[a-z&.' ]+$/i.test(plain) && plain.split(" ").filter(Boolean).length >= 2) return value;
  }
  return null;
}

function institutionIn(lines: string[], section: Section): string | null {
  for (let index = section.start; index < section.end; index += 1) {
    const plain = normalize(lines[index]);
    const match = plain.match(/^(instituicao|banco)\b/);
    if (match) {
      const rest = cleanValue(lines[index].slice(match[0].length));
      const value = rest || (index + 1 < section.end ? cleanValue(lines[index + 1]) : "");
      const bank = bankFromLabel(value);
      if (bank) return bank;
    }
  }
  for (let index = section.start; index < section.end; index += 1) {
    const bank = bankFromLabel(lines[index]);
    if (bank) return bank;
  }
  return null;
}

const MONTHS: Record<string, number> = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };

function dateIn(text: string): string | null {
  const numeric = text.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  if (numeric) return `${numeric[3]}-${numeric[2]}-${numeric[1]}`;
  const written = normalize(text).match(/\b(\d{1,2})\s+(?:de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?\s+(?:de\s+)?(\d{4})\b/);
  if (written) return `${written[3]}-${String(MONTHS[written[2]]).padStart(2, "0")}-${written[1].padStart(2, "0")}`;
  return null;
}

/** Nome em caixa alta vira "Nome Próprio" para a descrição. */
function displayName(name: string): string {
  if (name !== name.toUpperCase()) return name;
  return name
    .toLowerCase()
    .split(" ")
    .map((word) => (["da", "de", "do", "das", "dos", "e"].includes(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

export function parseReceipt(text: string): ReceiptResult {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const plain = normalize(lines.join("\n"));
  if (!LOOKS_LIKE_RECEIPT.test(plain)) return { ok: false, reason: "não parece um comprovante de Pix ou transferência" };

  // Valor: a linha "Valor …" vale mais que a primeira quantia (que pode ser tarifa).
  const valueLine = lines.find((line) => /^valor\b/i.test(normalize(line)) && MONEY.test(line));
  const amountMatch = (valueLine ?? lines.find((line) => MONEY.test(line) && parseAmount(line.match(MONEY)![1])))?.match(MONEY);
  const amount = amountMatch ? parseAmount(amountMatch[1]) : null;
  if (!amount) return { ok: false, reason: "sem valor em reais" };

  const type: ParsedReceipt["type"] = INCOMING.test(plain) ? "entrada" : "saida";
  const receiver = findSection(lines, RECEIVER_MARK, PAYER_MARK);
  const payer = findSection(lines, PAYER_MARK, RECEIVER_MARK);
  const other = type === "saida" ? receiver : payer;
  const mine = type === "saida" ? payer : receiver;
  const otherName = other ? nameIn(lines, other, type === "saida" ? RECEIVER_MARK : PAYER_MARK) : null;

  const transactionId = text.match(/\b(E\d{8}\d{12}[A-Za-z0-9]{11})\b/)?.[1] ?? null;
  // Banco da conta do usuário: a instituição de quem pagou (ou recebeu); sem ela, o banco que
  // emitiu o Pix (está no identificador) ou o logotipo no topo do comprovante.
  const bank =
    (mine ? institutionIn(lines, mine) : null) ??
    (type === "saida" && transactionId ? bankFromCnpj(transactionId.slice(1, 9)) : null) ??
    lines.slice(0, 3).map((line) => bankFromLabel(line)).find(Boolean) ??
    null;

  const isBoleto = /boleto|beneficiario/.test(plain);
  const isTed = /\bted\b/.test(plain) && !/\bpix\b/.test(plain);
  const name = otherName ? displayName(otherName) : null;
  let description: string;
  if (type === "entrada") description = name ? `Recebido de ${name}` : "Pix recebido";
  else if (isBoleto) description = name ? `Boleto ${name}` : "Pagamento de boleto";
  else if (isTed) description = name ? `Transferência para ${name}` : "Transferência enviada";
  else description = name ? `Pix para ${name}` : "Pix enviado";

  return {
    ok: true,
    parsed: { amount, type, kind: "account", bank, description, date: dateIn(lines.join("\n")), transactionId },
  };
}
