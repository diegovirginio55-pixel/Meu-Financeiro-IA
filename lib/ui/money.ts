// Sem "use client": funções puras, servem no servidor e no cliente.

const THOUSANDS_WITH_COMMA = /^\d{1,3}(\.\d{3})+(,\d+)?$/;
const PLAIN_WITH_COMMA = /^\d+(,\d+)?$/;
const THOUSANDS_ONLY_DOTS = /^[1-9]\d{0,2}(\.\d{3})+$/;
const DOT_DECIMAL = /^\d+(\.\d{1,2})?$/;

/**
 * Converte um valor digitado em reais para número.
 * Aceita "1500", "1.500", "1.500,50", "1500,5", "R$ 1.500,00", "12.5" e sinal de menos.
 * Regras: com vírgula, pontos são milhar e a vírgula é decimal; sem vírgula, ponto seguido de
 * grupos de exatamente 3 dígitos é milhar ("1.500"), e ponto com 1–2 casas é decimal ("12.5").
 * Retorna `null` se estiver vazio ou inválido (nunca transforma "" em 0).
 */
export function parseBRL(text: string | null | undefined): number | null {
  if (text == null) return null;
  let value = String(text)
    .replace(/R\$/gi, "")
    .replace(/[\s  ]/g, "");
  if (!value) return null;

  let sign = 1;
  if (value.startsWith("-")) {
    sign = -1;
    value = value.slice(1);
  } else if (value.startsWith("+")) {
    value = value.slice(1);
  }
  if (!value) return null;

  let normalized: string;
  if (value.includes(",")) {
    if (!THOUSANDS_WITH_COMMA.test(value) && !PLAIN_WITH_COMMA.test(value)) return null;
    normalized = value.replace(/\./g, "").replace(",", ".");
  } else if (THOUSANDS_ONLY_DOTS.test(value)) {
    normalized = value.replace(/\./g, "");
  } else if (DOT_DECIMAL.test(value)) {
    normalized = value;
  } else {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return (sign * Math.round(parsed * 100)) / 100;
}

/** Número → texto para preencher um campo de valor ("1.500,00"). `null` vira "". */
export function formatBRLInput(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
