import { NextResponse } from "next/server";
import { getVapidKeys } from "@/lib/push/vapid";

export async function GET() {
  const keys = await getVapidKeys();
  if (!keys) {
    return NextResponse.json({ error: "push-unavailable" }, { status: 503 });
  }
  return NextResponse.json({ publicKey: keys.publicKey });
}
