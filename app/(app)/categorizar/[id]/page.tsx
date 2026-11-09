import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CategorizeClient from "@/components/notifications/CategorizeClient";
import { PageShell, SoftPanel } from "@/components/ui/page-chrome";

export const dynamic = "force-dynamic";

/** Aberta ao tocar na notificação de um gasto novo. */
export default async function CategorizarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select("id, description, amount, type, category, date")
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    return (
      <PageShell>
        <div className="mx-auto w-full max-w-lg px-4 pt-2">
          <SoftPanel className="flex flex-col gap-3 p-4">
            <p className="text-sm text-zinc-300">Esse lançamento não existe mais (pode ter sido excluído).</p>
            <Link href="/detalhes" className="text-sm font-medium text-emerald-300 hover:underline">
              Ver extrato
            </Link>
          </SoftPanel>
        </div>
      </PageShell>
    );
  }

  return <CategorizeClient transaction={data} />;
}
