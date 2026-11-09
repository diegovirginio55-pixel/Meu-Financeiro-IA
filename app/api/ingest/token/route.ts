import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ingestTokenFor, rotateIngestToken } from "@/lib/ingest/token";
import { serverError } from "@/lib/api/errors";

const NO_STORE = { "Cache-Control": "no-store" };

/** Token pessoal do "Saldo em tempo real" (para o MacroDroid / Atalhos). */
export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const token = await ingestTokenFor(userData.user.id);
  if (!token) return serverError("O servidor não está configurado para gerar o token.");
  return NextResponse.json({ token }, { headers: NO_STORE });
}

/** Gera um token novo — o anterior para de funcionar na hora. */
export async function POST() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const token = await rotateIngestToken(userData.user.id);
  if (!token) return serverError("Não foi possível gerar um token novo.");
  return NextResponse.json({ token }, { headers: NO_STORE });
}
