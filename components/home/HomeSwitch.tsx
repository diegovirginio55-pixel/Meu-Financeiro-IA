"use client";

import BankHome from "@/components/home/BankHome";
import type { BankConnectionWithAssets } from "@/lib/finance/bank-connections";
import type { FinancialSnapshot } from "@/lib/finance/summary";
import type { InvestmentSnapshot, InvestmentTxn, Transaction } from "@/lib/finance/types";

export default function HomeSwitch({
  snapshot,
  connections,
}: {
  snapshot: FinancialSnapshot;
  connections: BankConnectionWithAssets[];
  historyTx?: Transaction[];
  snapshots?: InvestmentSnapshot[];
  investmentTx?: InvestmentTxn[];
}) {
  return <BankHome snapshot={snapshot} connections={connections} />;
}
