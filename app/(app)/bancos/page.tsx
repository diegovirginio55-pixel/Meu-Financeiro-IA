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

      <div className="rounded-2xl border border-amber-900/70 bg-amber-950/40 p-4 text-sm text-amber-100">
        <p className="font-medium text-amber-50">Conta Pluggy ainda em modo demo</p>
        <p className="mt-1 text-amber-200/90">
          Inter, Nubank e outros bancos reais só ligam depois que a Pluggy liberar produção.
          Enquanto isso, o widget só aceita o banco de teste (Pluggy Bank).
        </p>
        <a
          href="https://dashboard.pluggy.ai/applications"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex rounded-full bg-amber-500 px-4 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400"
        >
          Abrir Pluggy e ir para produção
        </a>
      </div>

      <BancosClient initialConnections={(data ?? []) as BankConnection[]} />
    </div>
  );
}
