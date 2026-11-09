import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncBankConnectionSafely } from "@/lib/pluggy/sync";
import { pluggyApi } from "@/lib/pluggy/client";
import { serverError } from "@/lib/api/errors";

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

  // O itemId vem do navegador: confirma na Pluggy que o item foi criado
  // pelo connect token deste usuário (clientUserId), para ninguém importar
  // o banco de outra pessoa informando um itemId alheio.
  try {
    const item = await pluggyApi.fetchItem(itemId);
    if (item.clientUserId && item.clientUserId !== user.id) {
      return NextResponse.json({ error: "Conexão não pertence a este usuário." }, { status: 403 });
    }
  } catch (error) {
    // Pluggy indisponível agora: não bloqueia a conexão (o sync abaixo
    // também usa a Pluggy e vai falhar ou funcionar do mesmo jeito).
    console.error("Erro ao validar item da Pluggy:", error);
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
    return serverError("Falha ao salvar conexão.", error);
  }

  try {
    await syncBankConnectionSafely(supabase, user.id, connection.id, itemId);
  } catch (syncError) {
    console.error("Erro na primeira sincronização da conexão bancária:", syncError);
    // A conexão já foi salva; a sincronização pode ser tentada de novo depois (webhook ou botão manual).
  }

  return NextResponse.json({ connection });
}
