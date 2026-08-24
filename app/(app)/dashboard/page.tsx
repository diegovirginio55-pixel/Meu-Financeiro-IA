import { createClient } from "@/lib/supabase/server";
import { getFinancialSnapshot } from "@/lib/finance/summary";
import SummaryCards from "@/components/dashboard/SummaryCards";
import EntradasDespesasChart from "@/components/dashboard/EntradasDespesasChart";
import CategoriaPieChart from "@/components/dashboard/CategoriaPieChart";
import {
  MaioresGastos,
  ProximasContas,
  GoalsProgress,
  InvestmentsList,
} from "@/components/dashboard/ListPanels";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const snapshot = await getFinancialSnapshot(supabase);
  const { count: bankCount } = await supabase
    .from("bank_connections")
    .select("*", { count: "exact", head: true });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-50">Visão Geral</h1>
        <p className="text-sm text-zinc-400">
          Sua situação financeira, atualizada em tempo real.
        </p>
      </div>

      {(bankCount ?? 0) === 0 && (
        <Link
          href="/bancos"
          className="rounded-2xl border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-100 transition-colors hover:border-emerald-600"
        >
          <p className="font-medium text-emerald-50">Nubank ainda não está neste painel</p>
          <p className="mt-1 text-emerald-200/80">
            A conexão no Meu Pluggy já existe. Clique aqui para autorizar uma vez e importar saldo e extrato.
          </p>
        </Link>
      )}

      <SummaryCards snapshot={snapshot} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EntradasDespesasChart data={snapshot.evolucaoMensal} />
        </div>
        <CategoriaPieChart data={snapshot.gastosPorCategoria} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <InvestmentsList investments={snapshot.investments} />
        <ProximasContas
          items={snapshot.proximos30Dias}
          saldoPrevisto={snapshot.saldoPrevisto30Dias}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MaioresGastos items={snapshot.maioresGastos} />
        <GoalsProgress goals={snapshot.goals} />
      </div>
    </div>
  );
}
