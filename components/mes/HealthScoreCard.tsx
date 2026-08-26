import type { FactorStatus, HealthScoreResult } from "@/lib/finance/health-score";
import { healthScoreLabel, healthScoreTone } from "@/lib/finance/health-score";
import { SoftPanel } from "@/components/ui/page-chrome";

const STATUS_STYLES: Record<FactorStatus, { dot: string; bar: string; chip: string }> = {
  green: { dot: "🟢", bar: "bg-emerald-400", chip: "bg-emerald-500/10 text-emerald-300" },
  yellow: { dot: "🟡", bar: "bg-amber-400", chip: "bg-amber-500/10 text-amber-300" },
  red: { dot: "🔴", bar: "bg-rose-400", chip: "bg-rose-500/10 text-rose-300" },
};

function ScoreRing({ score, color, glow }: { score: number; color: string; glow: string }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;
  return (
    <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
      <div className="absolute inset-2 rounded-full blur-xl" style={{ backgroundColor: glow }} />
      <svg viewBox="0 0 100 100" className="relative h-28 w-28 -rotate-0" aria-hidden>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#27272a" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold leading-none text-white">{Math.round(score)}</span>
        <span className="mt-0.5 text-[10px] uppercase tracking-wide text-zinc-500">de 100</span>
      </div>
    </div>
  );
}

export function HealthScoreCard({ result }: { result: HealthScoreResult }) {
  const colors = healthScoreTone(result.score);
  return (
    <SoftPanel className="relative overflow-hidden p-5 lg:p-6">
      <div className="pointer-events-none absolute -right-10 -top-14 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800 text-sm">🩺</span>
        <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">Saúde financeira</h2>
      </div>

      <div className="relative mt-4 flex items-center gap-5">
        <ScoreRing score={result.score} color={colors.stroke} glow={colors.glow} />
        <div>
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${colors.badge}`}>
            {healthScoreLabel(result.score)}
          </span>
          <p className="mt-2 text-sm text-zinc-400">
            Nota calculada a partir de 8 indicadores da sua vida financeira.
          </p>
        </div>
      </div>

      <ul className="relative mt-6 flex flex-col gap-2.5">
        {result.factors.map((factor) => {
          const style = STATUS_STYLES[factor.status];
          return (
            <li
              key={factor.key}
              className="flex items-start gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3"
            >
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] ${style.chip}`}>
                {style.dot}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-zinc-200">{factor.label}</span>
                  <span className="shrink-0 text-xs text-zinc-500">{Math.round(factor.score)}/100</span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">{factor.detail}</p>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className={`h-full rounded-full ${style.bar}`}
                    style={{ width: `${Math.max(4, Math.min(100, factor.score))}%` }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {result.howToImprove.length > 0 && (
        <div className="relative mt-5 overflow-hidden rounded-xl border border-emerald-800/50 bg-gradient-to-br from-emerald-950/40 to-emerald-900/10 p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-300">
            <span>✨</span> Como subir sua nota
          </p>
          <ul className="mt-2.5 flex flex-col gap-2">
            {result.howToImprove.map((item) => (
              <li key={item.factor} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 text-zinc-300">{item.tip}</span>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                  {result.score} → {item.potentialScore}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SoftPanel>
  );
}
