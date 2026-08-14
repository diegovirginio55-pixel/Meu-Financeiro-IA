import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pluggyClient } from "@/lib/pluggy/client";
import { syncBankConnection } from "@/lib/pluggy/sync";

async function loadOwnedConnection(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  id: string,
) {
  const { data } = await supabase
    .from("bank_connections")
    .select("*")
    .eq("id", id)
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

  try {
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
    await pluggyClient.deleteItem(connection.pluggy_item_id);
  } catch (error) {
    console.error("Erro ao remover item na Pluggy (seguindo com a remoção local):", error);
  }

  await supabase.from("bank_connections").delete().eq("id", connection.id);

  return NextResponse.json({ ok: true });
}
