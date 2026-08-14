import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pluggyApi } from "@/lib/pluggy/client";

function publicOrigin(request: Request) {
  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  if (renderUrl) return renderUrl.replace(/\/$/, "");

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  if (host && !host.includes("localhost") && !host.startsWith("0.0.0.0")) {
    return `${proto}://${host}`;
  }
  return null;
}

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

  const origin = publicOrigin(request);
  const webhookUrl = origin ? `${origin}/api/bank/webhook` : undefined;

  try {
    const { accessToken } = await pluggyApi.createConnectToken({
      clientUserId: user.id,
      webhookUrl,
      avoidDuplicates: true,
    });

    return NextResponse.json({ accessToken });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível iniciar a conexão bancária.";
    console.error("Erro ao criar connect token da Pluggy:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
