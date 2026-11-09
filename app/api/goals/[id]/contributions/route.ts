import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serverError } from "@/lib/api/errors";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("goal_contributions")
    .select("*")
    .eq("goal_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return serverError("Não foi possível concluir a operação.", error);
  }
  return NextResponse.json({ contributions: data ?? [] });
}
