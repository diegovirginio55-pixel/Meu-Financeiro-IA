"use client";

import dynamic from "next/dynamic";

// Gráficos (Recharts) carregados sob demanda, só no navegador: tiram o Recharts do bundle inicial
// das telas e evitam SVG diferente entre servidor e cliente. O placeholder tem a mesma altura do
// gráfico para a página não "pular" quando ele aparece.

function ChartPlaceholder({ className }: { className: string }) {
  return <div aria-hidden className={`w-full animate-pulse rounded-xl bg-zinc-900/40 ${className}`} />;
}

const TALL = "h-[260px] lg:h-[340px]";
const MEDIUM = "h-[240px] lg:h-[300px]";

export const SaldoEvolutionChart = dynamic(
  () => import("@/components/dashboard/OverviewCharts").then((mod) => mod.SaldoEvolutionChart),
  { ssr: false, loading: () => <ChartPlaceholder className={TALL} /> },
);

export const FluxoBarrasChart = dynamic(
  () => import("@/components/dashboard/OverviewCharts").then((mod) => mod.FluxoBarrasChart),
  { ssr: false, loading: () => <ChartPlaceholder className={TALL} /> },
);

export const GastosDonutChart = dynamic(
  () => import("@/components/dashboard/OverviewCharts").then((mod) => mod.GastosDonutChart),
  { ssr: false, loading: () => <ChartPlaceholder className={TALL} /> },
);

export const EconomiaMensalChart = dynamic(
  () => import("@/components/dashboard/ExtraCharts").then((mod) => mod.EconomiaMensalChart),
  { ssr: false, loading: () => <ChartPlaceholder className={MEDIUM} /> },
);

export const FluxoDiarioChart = dynamic(
  () => import("@/components/dashboard/ExtraCharts").then((mod) => mod.FluxoDiarioChart),
  { ssr: false, loading: () => <ChartPlaceholder className={MEDIUM} /> },
);

export const SemanaGastosChart = dynamic(
  () => import("@/components/dashboard/ExtraCharts").then((mod) => mod.SemanaGastosChart),
  { ssr: false, loading: () => <ChartPlaceholder className={MEDIUM} /> },
);

export const CategoryCompareChart = dynamic(
  () => import("@/components/dashboard/ExtraCharts").then((mod) => mod.CategoryCompareChart),
  { ssr: false, loading: () => <ChartPlaceholder className="h-[240px]" /> },
);

export const MixPizzaChart = dynamic(
  () => import("@/components/dashboard/ExtraCharts").then((mod) => mod.MixPizzaChart),
  { ssr: false, loading: () => <ChartPlaceholder className={MEDIUM} /> },
);

export const LucroAtivosBarChart = dynamic(
  () => import("@/components/dashboard/ExtraCharts").then((mod) => mod.LucroAtivosBarChart),
  { ssr: false, loading: () => <ChartPlaceholder className="h-[240px]" /> },
);

export const RendimentoDiarioChart = dynamic(
  () => import("@/components/dashboard/ExtraCharts").then((mod) => mod.RendimentoDiarioChart),
  { ssr: false, loading: () => <ChartPlaceholder className="h-[268px] lg:h-[312px]" /> },
);

export const RendimentoMensalChart = dynamic(
  () => import("@/components/dashboard/ExtraCharts").then((mod) => mod.RendimentoMensalChart),
  { ssr: false, loading: () => <ChartPlaceholder className="h-[256px] lg:h-[296px]" /> },
);
