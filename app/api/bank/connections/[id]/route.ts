import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pluggyApi } from "@/lib/pluggy/client";
import { syncBankConnection } from "@/lib/pluggy/sync";
import { realConnectionId } from "@/lib/finance/connection-filter";

async function loadOwnedConnection(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  id: string,
) {
  const { data } = await supabase
    .from("bank_connections")
    .select("*")
    .eq("id", realConnectionId(id))
    .eq("user_id", userId)
    .single();
  return data;
}

/** Sincroniza manualmente uma conexão específica (botão "Sincronizar agora"). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const connection = await loadOwnedConnection(supabase, user.id, id);
  if (!connection) {
    return NextResponse.json({ error: "Conexão não encontrada." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { trigger?: boolean };
  const trigger = body.trigger !== false;

  try {
    if (trigger) {
      try {
        await pluggyApi.patchItem(connection.pluggy_item_id, {});
        const item = await pluggyApi.waitForItemIdle(connection.pluggy_item_id);
        if (item.status === "WAITING_USER_INPUT" || item.status === "LOGIN_ERROR") {
          return NextResponse.json({ needsWidget: true });
        }
      } catch (error) {
        // Conexões feitas via "MeuPluggy" (conector 200) não aceitam pedido de
        // atualização sob demanda — a Pluggy retorna 400 "item cant be updated"
        // e só sincroniza esses itens automaticamente 1x por dia. Nesse caso não
        // há widget para abrir: seguimos e buscamos os dados mais recentes que a
        // Pluggy já tiver em cache, em vez de encerrar sem sincronizar nada.
        console.error("Não foi possível pedir atualização à Pluggy, buscando dados em cache:", error);
      }
    }
    await syncBankConnection(supabase, user.id, connection.id, connection.pluggy_item_id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro ao sincronizar conexão bancária:", error);
    return NextResponse.json({ error: "Falha ao sincronizar com o banco." }, { status: 500 });
  }
}

/** Desconecta um banco: remove o item na Pluggy e a conexão local. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const connection = await loadOwnedConnection(supabase, user.id, id);
  if (!connection) {
    return NextResponse.json({ error: "Conexão não encontrada." }, { status: 404 });
  }

  try {
    await pluggyApi.deleteItem(connection.pluggy_item_id);
  } catch (error) {
    console.error("Erro ao remover item na Pluggy (seguindo com a remoção local):", error);
  }

  await supabase.from("bank_connections").delete().eq("id", connection.id);

  return NextResponse.json({ ok: true });
}
