import { CATEGORIES } from "./categories";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AMOUNT = 1_000_000_000;

/** "YYYY-MM-DD" que existe de verdade no calendário (rejeita 2026-11-31). */
export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Valor em reais positivo, finito e arredondado em centavos; null se inválido. */
export function parsePositiveMoney(value: unknown): number | null {
  const amount = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) return null;
  return Math.round(amount * 100) / 100;
}

/** Valor em reais (pode ser zero ou negativo, ex.: saldo), arredondado; null se inválido. */
export function parseMoney(value: unknown): number | null {
  const amount = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
  if (!Number.isFinite(amount) || Math.abs(amount) > MAX_AMOUNT) return null;
  return Math.round(amount * 100) / 100;
}

export function isTransactionType(value: unknown): value is "entrada" | "saida" {
  return value === "entrada" || value === "saida";
}

/** Categoria conhecida; qualquer outra coisa vira "Outros". */
export function normalizeCategory(value: unknown): string {
  if (typeof value !== "string") return "Outros";
  const trimmed = value.trim();
  const match = CATEGORIES.find((category) => category.toLowerCase() === trimmed.toLowerCase());
  return match ?? "Outros";
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
}

type ParseResult = { ok: true; updates: Record<string, unknown> } | { ok: false; error: string };

/** Valida o corpo do PATCH de um lançamento (só campos editáveis). */
export function parseTransactionUpdate(body: unknown): ParseResult {
  if (!body || typeof body !== "object") return { ok: false, error: "Corpo inválido." };
  const input = body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};

  if ("description" in input) {
    const description = cleanText(input.description, 200);
    if (!description) return { ok: false, error: "Informe uma descrição." };
    updates.description = description;
  }
  if ("amount" in input) {
    const amount = parsePositiveMoney(input.amount);
    if (amount == null) return { ok: false, error: "Informe um valor maior que zero." };
    updates.amount = amount;
  }
  if ("type" in input) {
    if (!isTransactionType(input.type)) return { ok: false, error: "Tipo inválido." };
    updates.type = input.type;
  }
  if ("category" in input) {
    const category = cleanText(input.category, 60);
    if (!category) return { ok: false, error: "Informe uma categoria." };
    updates.category = category;
  }
  if ("date" in input) {
    if (!isValidDateKey(input.date)) return { ok: false, error: "Data inválida." };
    updates.date = input.date;
  }
  for (const field of ["account_id", "card_id"] as const) {
    if (!(field in input)) continue;
    const value = input[field];
    if (value === null || value === "") updates[field] = null;
    else if (typeof value === "string" && UUID.test(value)) updates[field] = value;
    else return { ok: false, error: "Conta ou cartão inválido." };
  }

  if (Object.keys(updates).length === 0) return { ok: false, error: "Nada para atualizar." };
  return { ok: true, updates };
}
