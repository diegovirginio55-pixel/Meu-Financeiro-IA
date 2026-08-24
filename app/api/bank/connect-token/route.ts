import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pluggyApi } from "@/lib/pluggy/client";
import { publicOrigin } from "@/lib/pluggy/origin";

/**
 * Gera um connect token de curta duração (30 min) para abrir o widget da
 * Pluggy Connect no navegador. O CLIENT_SECRET nunca chega ao front-end.
 * Se já existir um item Meu Pluggy, envia itemId para atualizar (ex.: Inter)
 * em vez de criar uma conexão nova — isso evita o erro de duplicata.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { itemId?: string };
  const origin = publicOrigin(request);
  const webhookUrl = origin ? `${origin}/api/bank/webhook` : undefined;
  const oauthRedirectUri = origin ? `${origin}/bancos` : undefined;

  try {
    const { accessToken } = await pluggyApi.createConnectToken({
      clientUserId: user.id,
      webhookUrl,
      oauthRedirectUri,
      avoidDuplicates: true,
      itemId: body.itemId,
    });

    return NextResponse.json({ accessToken });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível iniciar a conexão bancária.";
    console.error("Erro ao criar connect token da Pluggy:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
