import { createClient } from "@/lib/supabase/server";
import BancosClient from "@/components/bancos/BancosClient";
import type { BankConnection } from "@/lib/finance/types";

export const dynamic = "force-dynamic";

export default async function BancosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bank_connections")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-50">Bancos conectados</h1>
        <p className="text-sm text-zinc-400">
          Conecte seus bancos reais para importar saldo e extrato automaticamente.
        </p>
      </div>

      <BancosClient initialConnections={(data ?? []) as BankConnection[]} />
    </div>
  );
}
