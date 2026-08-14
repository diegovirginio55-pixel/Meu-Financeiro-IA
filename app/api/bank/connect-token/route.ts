import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pluggyClient } from "@/lib/pluggy/client";

/**
 * Gera um connect token de curta duração (30 min) para abrir o widget da
 * Pluggy Connect no navegador. O CLIENT_SECRET nunca chega ao front-end.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const webhookUrl = `${new URL(request.url).origin}/api/bank/webhook`;

  try {
    const { accessToken } = await pluggyClient.createConnectToken(undefined, {
      clientUserId: user.id,
      webhookUrl,
      avoidDuplicates: true,
    });

    return NextResponse.json({ accessToken });
  } catch (error) {
    console.error("Erro ao criar connect token da Pluggy:", error);
    return NextResponse.json({ error: "Não foi possível iniciar a conexão bancária." }, { status: 500 });
  }
}
