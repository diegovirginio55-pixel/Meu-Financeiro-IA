"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatCurrency } from "@/lib/finance/format";

/**
 * Peças dos gráficos do Dashboard (SVG próprio, sem biblioteca): medem a
 * largura real do cartão para o texto ficar sempre legível, usam as
 * variáveis de cor do tema (claro/escuro) e mostram o detalhe ao tocar.
 */
export const INK = {
  text: "var(--color-zinc-500, #71717a)",
  strong: "var(--color-zinc-100, #f4f4f5)",
  grid: "var(--color-zinc-800, #27272a)",
  axis: "var(--color-zinc-600, #52525b)",
  surface: "var(--color-zinc-900, #18181b)",
  track: "var(--color-zinc-800, #27272a)",
  good: "#10b981",
  goodSoft: "#34d399",
  bad: "#fb7185",
  blue: "#60a5fa",
} as const;

export const money = (value: number) => formatCurrency(value);
export const moneyShort = (value: number) => formatCurrency(value).replace(",00", "");
export function moneyCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `R$ ${(value / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return moneyShort(value);
}

/** Largura real do elemento (atualiza ao girar o celular / redimensionar). */
export function useChartWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export type TipState = { x: number; y: number; title: string; lines: string[] } | null;

export function useTip() {
  const [tip, setTip] = useState<TipState>(null);
  return {
    tip,
    show: (x: number, y: number, title: string, lines: string[]) => setTip({ x, y, title, lines }),
    hide: () => setTip(null),
  };
}

export function TipBox({ tip, width }: { tip: TipState; width: number }) {
  if (!tip) return null;
  const left = Math.min(Math.max(4, width - 190), Math.max(4, tip.x + 12));
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-xl px-3 py-2 text-xs shadow-xl"
      style={{
        left,
        top: Math.max(0, tip.y - 14),
        background: "var(--chart-tooltip-bg)",
        border: "1px solid var(--chart-tooltip-border)",
        color: "var(--chart-tooltip-fg)",
      }}
    >
      <b className="block">{tip.title}</b>
      {tip.lines.map((line) => (
        <span key={line} className="block opacity-80">
          {line}
        </span>
      ))}
    </div>
  );
}

/** Cartão de gráfico: título, frase que resume o gráfico e o desenho. */
export function ChartCard({
  title,
  headline,
  legend,
  children,
  className = "",
}: {
  title: string;
  headline?: ReactNode;
  legend?: { label: string; color: string; kind?: "box" | "dot" | "dash" | "ring" }[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 lg:rounded-3xl lg:p-5 ${className}`}>
      <h2 className="text-sm font-medium text-zinc-200">{title}</h2>
      {headline ? <p className="mt-1 text-xs text-zinc-400">{headline}</p> : null}
      {legend && legend.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
          {legend.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5">
              <LegendSwatch color={item.color} kind={item.kind ?? "box"} />
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function LegendSwatch({ color, kind }: { color: string; kind: "box" | "dot" | "dash" | "ring" }) {
  if (kind === "dash") return <span className="inline-block w-3.5 border-t-2 border-dashed" style={{ borderColor: color }} />;
  if (kind === "ring") return <span className="inline-block h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: color }} />;
  return <span className={`inline-block h-2.5 w-2.5 ${kind === "dot" ? "rounded-full" : "rounded-[3px]"}`} style={{ background: color }} />;
}

/** Número que sobe contando ao aparecer (respeita "reduzir movimento"). */
export function AnimatedMoney({ value, className = "" }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = shown.current;
    if (reduce || from === value) {
      element.textContent = formatCurrency(value);
      shown.current = value;
      return;
    }
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      const current = from + (value - from) * (1 - Math.pow(1 - t, 3));
      element.textContent = formatCurrency(current);
      shown.current = current;
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {formatCurrency(value)}
    </span>
  );
}
