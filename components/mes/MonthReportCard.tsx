import type { MonthReport } from "@/lib/finance/month-report";
import { formatCurrency } from "@/lib/finance/format";
import { SectionLabel, SoftPanel } from "@/components/ui/page-chrome";

function ReportKpi({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
      <p className="text-xs text-zinc-500">
        {icon} {label}
      </p>
      <p className={`mt-1 truncate text-sm font-semibold sm:text-base ${color}`}>{formatCurrency(value)}</p>
    </div>
  );
}

export function MonthReportCard({ report }: { report: MonthReport }) {
  return (
    <SoftPanel className="p-5 lg:p-6">
      <SectionLabel>Relatório do mês</SectionLabel>
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="text-lg font-semibold text-white">{report.monthLabel}</p>
        <p className="shrink-0 text-sm text-zinc-400">{report.progressPct}% concluído</p>
      </div>
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${report.progressPct}%` }} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ReportKpi icon="💰" label="Entradas" value={report.entradas} color="text-emerald-400" />
        <ReportKpi icon="💸" label="Saídas" value={report.saidas} color="text-rose-300" />
        <ReportKpi icon="📈" label="Investimentos" value={report.aportes} color="text-cyan-300" />
        <ReportKpi icon="💳" label="Faturas" value={report.faturas} color="text-amber-300" />
      </div>

      <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
        <p className="text-sm text-zinc-200">
          {report.ritmoStatus === "acima" && (
            <>
              Você está gastando{" "}
              <span className="font-semibold text-rose-300">{Math.abs(report.ritmoPct).toFixed(0)}% acima</span> do
              seu ritmo normal.
            </>
          )}
          {report.ritmoStatus === "abaixo" && (
            <>
              Você está gastando{" "}
              <span className="font-semibold text-emerald-300">{Math.abs(report.ritmoPct).toFixed(0)}% abaixo</span>{" "}
              do seu ritmo normal. 👏
            </>
          )}
          {report.ritmoStatus === "normal" && "Seu ritmo de gastos está normal este mês."}
        </p>
        {report.motivoPrincipal && (
          <p className="mt-1.5 text-sm text-zinc-500">
            Principal motivo: <span className="text-zinc-300">{report.motivoPrincipal.category}</span> (
            {formatCurrency(report.motivoPrincipal.diferenca)} acima do normal)
          </p>
        )}
        <p className="mt-1.5 text-sm text-zinc-500">
          Previsão para o fim do mês:{" "}
          <span className="font-medium text-zinc-200">{formatCurrency(report.previsaoFimMes)}</span> em saídas
        </p>
      </div>

      <div className="mt-5">
        <SectionLabel>O que fazer agora</SectionLabel>
        <ul className="flex flex-col gap-2">
          {report.recomendacoes.map((tip) => (
            <li key={tip} className="flex items-start gap-2 text-sm text-zinc-300">
              <span className="mt-0.5 text-emerald-400">✓</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </SoftPanel>
  );
}
