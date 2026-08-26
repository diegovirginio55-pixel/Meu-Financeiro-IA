"use client";

import { useMemo } from "react";
import type { FinancialSnapshot } from "@/lib/finance/summary";
import { computeMonthReport } from "@/lib/finance/month-report";
import { computeHealthScore } from "@/lib/finance/health-score";
import { computeInsights } from "@/lib/finance/insights";
import { buildFinancialCalendar } from "@/lib/finance/financial-calendar";
import { PageHero, PageShell } from "@/components/ui/page-chrome";
import { MonthReportCard } from "@/components/mes/MonthReportCard";
import { HealthScoreCard } from "@/components/mes/HealthScoreCard";
import { HealthScoreHeroBar } from "@/components/mes/HealthScoreHeroBar";
import { InsightsPanel } from "@/components/mes/InsightsPanel";
import { FinancialCalendarPanel } from "@/components/mes/FinancialCalendarPanel";

export default function MesClient({ snapshot }: { snapshot: FinancialSnapshot }) {
  const report = useMemo(
    () =>
      computeMonthReport({
        transactions: snapshot.historyTx,
        cards: snapshot.cards,
        goals: snapshot.goals,
      }),
    [snapshot.historyTx, snapshot.cards, snapshot.goals],
  );

  const health = useMemo(
    () =>
      computeHealthScore({
        transactions: snapshot.historyTx,
        cards: snapshot.cards,
        debts: snapshot.debts,
        goals: snapshot.goals,
        totalBalance: snapshot.totalBalance,
        totalInvestments: snapshot.totalInvestments,
      }),
    [snapshot.historyTx, snapshot.cards, snapshot.debts, snapshot.goals, snapshot.totalBalance, snapshot.totalInvestments],
  );

  const insights = useMemo(() => computeInsights({ transactions: snapshot.historyTx }), [snapshot.historyTx]);

  const calendar = useMemo(
    () =>
      buildFinancialCalendar({
        totalBalance: snapshot.totalBalance,
        recurring: snapshot.recurringItems,
        debts: snapshot.debts,
        cards: snapshot.cards,
      }),
    [snapshot.totalBalance, snapshot.recurringItems, snapshot.debts, snapshot.cards],
  );

  return (
    <PageShell>
      <PageHero kicker="Meu mês" title={report.monthLabel} subtitle={`${report.progressPct}% concluído deste mês`}>
        <HealthScoreHeroBar score={health.score} />
      </PageHero>

      <div className="flex flex-col gap-6 px-4 pb-2 lg:gap-8 lg:px-6 xl:px-10 2xl:px-14">
        <MonthReportCard report={report} />

        <div className="grid gap-6 lg:grid-cols-2">
          <HealthScoreCard result={health} />
          <InsightsPanel insights={insights} />
        </div>

        <FinancialCalendarPanel calendar={calendar} transactions={snapshot.historyTx} />
      </div>
    </PageShell>
  );
}
