import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncBankConnection } from "@/lib/pluggy/sync";

/**
 * Chamado pelo front-end depois que o widget da Pluggy Connect termina
 * com sucesso (onSuccess). Salva/atualiza a conexão e roda a primeira
 * sincronização de contas e extrato.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const itemId: string | undefined = body?.item?.id;
  const institutionName: string = body?.item?.connector?.name ?? "Banco conectado";
  const institutionImageUrl: string | null = body?.item?.connector?.imageUrl ?? null;
  const status: string = body?.item?.status ?? "UPDATING";

  if (!itemId) {
    return NextResponse.json({ error: "itemId ausente." }, { status: 400 });
  }

  const { data: connection, error } = await supabase
    .from("bank_connections")
    .upsert(
      {
        user_id: user.id,
        pluggy_item_id: itemId,
        institution_name: institutionName,
        institution_image_url: institutionImageUrl,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "pluggy_item_id" },
    )
    .select()
    .single();

  if (error || !connection) {
    return NextResponse.json({ error: error?.message ?? "Falha ao salvar conexão." }, { status: 500 });
  }

  try {
    await syncBankConnection(supabase, user.id, connection.id, itemId);
  } catch (syncError) {
    console.error("Erro na primeira sincronização da conexão bancária:", syncError);
    // A conexão já foi salva; a sincronização pode ser tentada de novo depois (webhook ou botão manual).
  }

  return NextResponse.json({ connection });
}
