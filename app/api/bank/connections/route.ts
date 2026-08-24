import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBankConnectionsWithAssets } from "@/lib/finance/bank-connections";

export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const connections = await getBankConnectionsWithAssets(supabase);
  return NextResponse.json({ connections });
}
