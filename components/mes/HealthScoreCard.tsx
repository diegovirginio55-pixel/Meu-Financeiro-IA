import type { FactorStatus, HealthScoreResult } from "@/lib/finance/health-score";
import { SectionLabel, SoftPanel } from "@/components/ui/page-chrome";

const STATUS_DOT: Record<FactorStatus, string> = { green: "🟢", yellow: "🟡", red: "🔴" };

function scoreLabel(score: number): string {
  if (score >= 80) return "Excelente";
  if (score >= 60) return "Boa";
  if (score >= 40) return "Regular";
  return "Precisa de atenção";
}

function scoreColor(score: number): string {
  if (score >= 70) return "#34d399";
  if (score >= 40) return "#fbbf24";
  return "#fb7185";
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;
  return (
    <svg viewBox="0 0 80 80" className="h-20 w-20 shrink-0" aria-hidden>
      <circle cx="40" cy="40" r={radius} fill="none" stroke="#27272a" strokeWidth="8" />
      <circle
        cx="40"
        cy="40"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 40 40)"
      />
    </svg>
  );
}

export function HealthScoreCard({ result }: { result: HealthScoreResult }) {
  const color = scoreColor(result.score);
  return (
    <SoftPanel className="p-5 lg:p-6">
      <SectionLabel>Saúde financeira</SectionLabel>
      <div className="flex items-center gap-4">
        <ScoreRing score={result.score} color={color} />
        <div>
          <p className="text-3xl font-semibold text-white">
            {result.score}
            <span className="text-base text-zinc-500">/100</span>
          </p>
          <p className="text-xs text-zinc-500">{scoreLabel(result.score)}</p>
        </div>
      </div>

      <ul className="mt-5 flex flex-col gap-2">
        {result.factors.map((factor) => (
          <li key={factor.key} className="flex items-start gap-2 text-sm">
            <span className="shrink-0">{STATUS_DOT[factor.status]}</span>
            <span className="text-zinc-300">{factor.detail}</span>
          </li>
        ))}
      </ul>

      {result.howToImprove.length > 0 && (
        <div className="mt-5 rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-4">
          <p className="text-sm font-medium text-emerald-300">Como subir sua nota</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {result.howToImprove.map((item) => (
              <li key={item.factor} className="text-sm text-zinc-300">
                {item.tip} <span className="text-zinc-500">→ pode chegar a {item.potentialScore}/100</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SoftPanel>
  );
}
