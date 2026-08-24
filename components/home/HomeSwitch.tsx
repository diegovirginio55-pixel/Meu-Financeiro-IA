"use client";

import BankHome from "@/components/home/BankHome";
import DashboardClient from "@/components/dashboard/DashboardClient";
import { usePhoneLayout } from "@/lib/ui/use-phone-layout";
import type { BankConnectionWithAssets } from "@/lib/finance/bank-connections";
import type { FinancialSnapshot } from "@/lib/finance/summary";
import type { Transaction } from "@/lib/finance/types";

export default function HomeSwitch({
  snapshot,
  connections,
  historyTx,
}: {
  snapshot: FinancialSnapshot;
  connections: BankConnectionWithAssets[];
  historyTx: Transaction[];
}) {
  const phone = usePhoneLayout();

  if (phone) {
    return <BankHome snapshot={snapshot} connections={connections} />;
  }

  return <DashboardClient snapshot={snapshot} connections={connections} historyTx={historyTx} />;
}
