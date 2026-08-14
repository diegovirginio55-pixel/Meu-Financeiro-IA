import { formatCurrency } from "@/lib/finance/format";
import type { FinancialSnapshot } from "@/lib/finance/summary";

function Card({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: number;
  icon: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-400"
      : tone === "negative"
        ? "text-red-400"
        : "text-zinc-50";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}

export default function SummaryCards({
  snapshot,
}: {
  snapshot: FinancialSnapshot;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <Card label="Patrimônio" value={snapshot.patrimonio} icon="💰" />
      <Card label="Saldo em contas" value={snapshot.totalBalance} icon="🏦" />
      <Card label="Faturas" value={snapshot.totalInvoices} icon="💳" tone="negative" />
      <Card label="Investimentos" value={snapshot.totalInvestments} icon="📈" tone="positive" />
      <Card label="Entradas (mês)" value={snapshot.monthEntradas} icon="📥" tone="positive" />
      <Card label="Despesas (mês)" value={snapshot.monthDespesas} icon="📤" tone="negative" />
      <Card
        label="Economia (mês)"
        value={snapshot.economia}
        icon="🟢"
        tone={snapshot.economia >= 0 ? "positive" : "negative"}
      />
      <Card label="Dívidas pendentes" value={snapshot.totalDebts} icon="🧾" tone="negative" />
    </div>
  );
}
