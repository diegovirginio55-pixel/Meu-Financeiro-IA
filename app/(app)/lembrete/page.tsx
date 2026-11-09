import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { verifyPushAction } from "@/lib/push/actions";
import { billKey, paidBillKeys } from "@/lib/finance/bill-reminders";
import BillReminderClient from "@/components/notifications/BillReminderClient";
import { PageShell, SoftPanel } from "@/components/ui/page-chrome";

export const dynamic = "force-dynamic";

function Expired() {
  return (
    <PageShell>
      <div className="mx-auto w-full max-w-lg px-4 pt-2">
        <SoftPanel className="flex flex-col gap-3 p-4">
          <p className="text-sm text-zinc-300">Este lembrete expirou ou não é desta conta.</p>
          <Link href="/mes" className="text-sm font-medium text-emerald-300 hover:underline">
            Ver calendário de contas
          </Link>
        </SoftPanel>
      </div>
    </PageShell>
  );
}

/** Aberta ao tocar no lembrete de conta a pagar (link com token assinado). */
export default async function LembretePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const claim = verifyPushAction(t);
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!t || !claim || claim.k !== "bill" || claim.u !== userData.user?.id) return <Expired />;

  const bill = { kind: claim.b, id: claim.r, dueDate: claim.d };
  let description = "Conta";
  let amount = 0;
  let alreadyPaid = false;

  if (bill.kind === "recurring") {
    const { data } = await supabase.from("recurring_items").select("description, amount").eq("id", bill.id).maybeSingle();
    if (!data) return <Expired />;
    description = data.description;
    amount = Number(data.amount);
  } else if (bill.kind === "debt") {
    const { data } = await supabase.from("debts").select("description, person, amount, paid").eq("id", bill.id).maybeSingle();
    if (!data) return <Expired />;
    description = data.person ? `${data.description} (${data.person})` : data.description;
    amount = Number(data.amount);
    alreadyPaid = Boolean(data.paid);
  } else {
    const { data } = await supabase.from("cards").select("name, current_invoice").eq("id", bill.id).maybeSingle();
    if (!data) return <Expired />;
    description = `Fatura ${data.name}`;
    amount = Number(data.current_invoice);
  }

  if (!alreadyPaid) {
    const paid = await paidBillKeys(supabase, userData.user.id);
    alreadyPaid = paid.has(billKey(bill));
  }

  return (
    <BillReminderClient
      token={t}
      description={description}
      amount={amount}
      dueDate={bill.dueDate}
      alreadyPaid={alreadyPaid}
    />
  );
}
