// Sem "use client": lido no servidor (app/(app)/layout.tsx) e no cliente.

/** Cookie espelho da preferência "ocultar valores", para o HTML do servidor já sair mascarado. */
export const HIDE_VALUES_COOKIE = "mf-hide-values";
/** Chave no localStorage (mesmo formato antigo: JSON `true`/`false`). */
export const HIDE_VALUES_KEY = "mf-hide-values";

export function hideValuesFromCookie(value: string | undefined): boolean {
  return value === "1";
}
