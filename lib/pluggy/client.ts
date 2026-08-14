import { PluggyClient } from "pluggy-sdk";

/**
 * Cliente server-side único, autenticado com CLIENT_ID/CLIENT_SECRET.
 * Nunca deve ser importado em código que roda no navegador.
 */
export const pluggyClient = new PluggyClient({
  clientId: process.env.PLUGGY_CLIENT_ID!,
  clientSecret: process.env.PLUGGY_CLIENT_SECRET!,
});
