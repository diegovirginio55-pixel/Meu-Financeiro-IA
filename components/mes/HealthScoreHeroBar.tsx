import { healthScoreLabel, healthScoreTone } from "@/lib/finance/health-score";

const SCALE_STOPS = [
  { pct: 0, label: "Frágil" },
  { pct: 50, label: "Regular" },
  { pct: 100, label: "Excelente" },
];

export function HealthScoreHeroBar({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const tone = healthScoreTone(score);

  return (
    <div className="w-full max-w-md">
      <div className="mb-2.5 flex items-end justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">Saúde financeira</span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold leading-none text-white">{Math.round(score)}</span>
          <span className="text-xs text-zinc-500">/100</span>
          <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tone.badge}`}>
            {healthScoreLabel(score)}
          </span>
        </span>
      </div>

      <div className="relative h-3.5 w-full rounded-full">
        <div
          className="absolute inset-0 rounded-full opacity-90"
          style={{ background: "linear-gradient(90deg, #fb7185 0%, #fbbf24 50%, #34d399 100%)" }}
        />
        <div
          className="absolute inset-y-0 right-0 rounded-r-full bg-zinc-950/75"
          style={{ left: `${clamped}%` }}
        />
        <div
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-zinc-950 shadow-[0_0_0_4px_rgba(0,0,0,0.25)] transition-[left] duration-700"
          style={{ left: `${clamped}%`, backgroundColor: tone.stroke, boxShadow: `0 0 12px 2px ${tone.glow}` }}
        />
      </div>

      <div className="mt-1.5 flex justify-between text-[10px] text-zinc-600">
        {SCALE_STOPS.map((stop) => (
          <span key={stop.pct}>{stop.label}</span>
        ))}
      </div>
    </div>
  );
}
