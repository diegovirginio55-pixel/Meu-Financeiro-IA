import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pluggyApi } from "@/lib/pluggy/client";
import { publicOrigin } from "@/lib/pluggy/origin";

/**
 * Gera um connect token de curta duração (30 min) para abrir o widget da
 * Pluggy Connect. Cada banco do Meu Pluggy precisa de uma autorização
 * própria (item novo). avoidDuplicates só na primeira conexão.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    itemId?: string;
    addAnother?: boolean;
  };
  const origin = publicOrigin(request);
  const webhookUrl = origin ? `${origin}/api/bank/webhook` : undefined;
  const oauthRedirectUri = origin ? `${origin}/bancos` : undefined;

  try {
    const { accessToken } = await pluggyApi.createConnectToken({
      clientUserId: user.id,
      webhookUrl,
      oauthRedirectUri,
      avoidDuplicates: !body.itemId && !body.addAnother,
      itemId: body.addAnother ? undefined : body.itemId,
    });

    return NextResponse.json({ accessToken, mode: body.itemId && !body.addAnother ? "update" : "create" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível iniciar a conexão bancária.";
    console.error("Erro ao criar connect token da Pluggy:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
