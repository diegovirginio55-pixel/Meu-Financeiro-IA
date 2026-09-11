"use client";

import { useMemo } from "react";
import type { FinancialSnapshot } from "@/lib/finance/summary";
import { computeMonthReport } from "@/lib/finance/month-report";
import { computeHealthScore } from "@/lib/finance/health-score";
import { alertCandidateToInsight, computeInsights } from "@/lib/finance/insights";
import { computeSmartAlertsFromData, computeWeeklySummaryFromData } from "@/lib/finance/alert-checks";
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

  const insights = useMemo(() => {
    const anomalies = computeInsights({ transactions: snapshot.historyTx });
    const smartAlerts = computeSmartAlertsFromData({
      accounts: snapshot.accounts,
      cards: snapshot.cards,
      recurring: snapshot.recurringItems,
      debts: snapshot.debts,
      tx: snapshot.historyTx,
      budget: snapshot.monthlyBudget,
    });
    const weeklySummary = computeWeeklySummaryFromData({ tx: snapshot.historyTx });
    const alertInsights = [...smartAlerts, ...(weeklySummary ? [weeklySummary] : [])].map((a) =>
      alertCandidateToInsight(a),
    );
    // Evita duplicar quando o mesmo assunto já aparece nas duas listas (ex:
    // aumento de assinatura detectado tanto no alerta quanto no insight).
    const seenKinds = new Set(anomalies.map((i) => i.kind));
    const merged = [...anomalies, ...alertInsights.filter((i) => !seenKinds.has(i.kind) || i.kind === "card_due" || i.kind === "low_balance")];
    return merged
      .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critico" ? -1 : b.severity === "critico" ? 1 : 0))
      .slice(0, 20);
  }, [snapshot.historyTx, snapshot.accounts, snapshot.cards, snapshot.recurringItems, snapshot.debts, snapshot.monthlyBudget]);

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
