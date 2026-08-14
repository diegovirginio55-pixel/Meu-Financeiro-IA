import { createClient } from "@/lib/supabase/server";
import { getFinancialSnapshot } from "@/lib/finance/summary";
import SummaryCards from "@/components/dashboard/SummaryCards";
import EntradasDespesasChart from "@/components/dashboard/EntradasDespesasChart";
import CategoriaPieChart from "@/components/dashboard/CategoriaPieChart";
import {
  MaioresGastos,
  ProximasContas,
  GoalsProgress,
} from "@/components/dashboard/ListPanels";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const snapshot = await getFinancialSnapshot(supabase);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-50">Visão Geral</h1>
        <p className="text-sm text-zinc-400">
          Sua situação financeira, atualizada em tempo real.
        </p>
      </div>

      <SummaryCards snapshot={snapshot} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EntradasDespesasChart data={snapshot.evolucaoMensal} />
        </div>
        <CategoriaPieChart data={snapshot.gastosPorCategoria} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MaioresGastos items={snapshot.maioresGastos} />
        <ProximasContas
          items={snapshot.proximos30Dias}
          saldoPrevisto={snapshot.saldoPrevisto30Dias}
        />
      </div>

      <GoalsProgress goals={snapshot.goals} />
    </div>
  );
}
