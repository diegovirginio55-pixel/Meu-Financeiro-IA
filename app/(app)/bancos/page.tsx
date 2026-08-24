import { createClient } from "@/lib/supabase/server";
import BancosClient from "@/components/bancos/BancosClient";
import { getBankConnectionsWithAssets } from "@/lib/finance/bank-connections";

export const dynamic = "force-dynamic";

export default async function BancosPage() {
  const supabase = await createClient();
  const connections = await getBankConnectionsWithAssets(supabase);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-50">Bancos conectados</h1>
        <p className="text-sm text-zinc-400">
          Importação gratuita dos seus bancos via Meu Pluggy (Open Finance do seu CPF).
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-900/70 bg-emerald-950/30 p-4 text-sm text-emerald-100">
        <p className="font-medium text-emerald-50">Como conectar sem pagar</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-emerald-200/90">
          <li>
            Em{" "}
            <a
              href="https://meu.pluggy.ai"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-emerald-500/60 underline-offset-2 hover:text-emerald-50"
            >
              meu.pluggy.ai
            </a>{" "}
            crie sua conta e conecte Inter, Nubank etc. (é aí que entra o CPF e o login do banco).
          </li>
          <li>
            Em{" "}
            <a
              href="https://dashboard.pluggy.ai/customization"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-emerald-500/60 underline-offset-2 hover:text-emerald-50"
            >
              dashboard.pluggy.ai/customization
            </a>{" "}
            habilite o conector <strong>MeuPluggy</strong> na sua aplicação.
          </li>
          <li>
            Volte aqui e clique em <strong>Conectar Meu Pluggy</strong>. Autorize com a mesma conta.
            Se tiver vários bancos no Meu Pluggy, clique em <strong>Conectar Meu Pluggy</strong> de novo
            e autorize o próximo banco (uma vez por instituição).
          </li>
        </ol>
      </div>

      <BancosClient initialConnections={connections} />
    </div>
  );
}
