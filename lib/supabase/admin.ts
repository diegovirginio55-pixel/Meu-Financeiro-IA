import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente com a service role key, que ignora RLS.
 * Uso restrito a contextos sem sessão de usuário (ex: webhook da Pluggy),
 * onde o próprio código já filtra explicitamente por user_id.
 * NUNCA usar em código que roda no navegador.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
