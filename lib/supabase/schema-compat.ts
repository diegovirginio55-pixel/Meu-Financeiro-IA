/**
 * Detecta erro de "coluna/tabela/função ainda não existe" — acontece quando o
 * código novo já foi publicado mas a migration correspondente ainda não foi
 * executada no Supabase. Nesses casos o app segue com o comportamento
 * anterior em vez de quebrar.
 */
export function isMissingSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: string; message?: string };
  if (code && ["PGRST202", "PGRST204", "PGRST205", "42703", "42P01", "42883"].includes(code)) return true;
  return /does not exist|could not find the .* (column|table|function)|schema cache/i.test(message ?? "");
}
