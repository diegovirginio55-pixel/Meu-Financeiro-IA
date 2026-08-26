import type { Insight, InsightSeverity } from "@/lib/finance/insights";
import { SectionLabel, SoftPanel } from "@/components/ui/page-chrome";

const SEVERITY_STYLES: Record<InsightSeverity, string> = {
  critico: "border-rose-800/60 bg-rose-950/20",
  atencao: "border-amber-800/50 bg-amber-950/10",
  info: "border-zinc-800 bg-zinc-950/40",
};

export function InsightsPanel({ insights }: { insights: Insight[] }) {
  return (
    <SoftPanel className="p-5 lg:p-6">
      <SectionLabel
        action={
          <span className="text-xs text-zinc-500">
            {insights.length} {insights.length === 1 ? "item" : "itens"}
          </span>
        }
      >
        Centro de alertas
      </SectionLabel>
      {insights.length === 0 ? (
        <p className="text-sm text-zinc-500">Nada fora do padrão detectado por agora. 👍</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {insights.map((insight) => (
            <li key={insight.id} className={`rounded-xl border p-3 ${SEVERITY_STYLES[insight.severity]}`}>
              <p className="text-sm text-zinc-100">
                <span className="mr-1.5">{insight.icon}</span>
                {insight.title}
              </p>
              <p className="mt-1 text-xs text-zinc-400">{insight.description}</p>
            </li>
          ))}
        </ul>
      )}
    </SoftPanel>
  );
}
