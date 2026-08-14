import { PluggyClient } from "pluggy-sdk";

let client: PluggyClient | null = null;

/**
 * Cliente server-side, autenticado com CLIENT_ID/CLIENT_SECRET.
 * Criado só na hora do uso para o `next build` não falhar se as
 * variáveis ainda não estiverem no ambiente (ex: primeiro deploy no Render).
 * Nunca deve ser importado em código que roda no navegador.
 */
export function getPluggyClient(): PluggyClient {
  if (client) return client;

  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET não estão configurados.");
  }

  client = new PluggyClient({ clientId, clientSecret });
  return client;
}
