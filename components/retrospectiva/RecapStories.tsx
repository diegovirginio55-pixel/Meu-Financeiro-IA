"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/finance/format";
import { monthName, type MonthRecap } from "@/lib/finance/month-recap";
import { PageShell } from "@/components/ui/page-chrome";

const DURATION_MS = 5000;
const short = (v: number) => formatCurrency(v).replace(",00", "");
const dayLabel = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Slide = { key: string; bg: string; tag: string; big: ReactNode; line?: ReactNode; foot?: ReactNode; art?: string };

function slidesFor(recap: MonthRecap, isCurrentMonth: boolean): Slide[] {
  const name = cap(monthName(recap.monthKey));
  const slides: Slide[] = [
    {
      key: "intro",
      bg: "radial-gradient(90% 60% at 30% 20%, #10b981, transparent 60%), linear-gradient(170deg, #064e3b, #09090b)",
      tag: isCurrentMonth ? "Seu mês até agora" : "Sua retrospectiva",
      big: name,
      line: "Veja como foi o seu mês com o dinheiro.",
      art: "✦",
    },
    {
      key: "gasto",
      bg: "radial-gradient(80% 60% at 80% 10%, #3b82f6, transparent 60%), linear-gradient(170deg, #1e1b4b, #09090b)",
      tag: "Você gastou",
      big: short(recap.spent),
      line:
        recap.change === null
          ? `em ${recap.count} compras e pagamentos`
          : Math.abs(recap.change) < 0.03
            ? "praticamente o mesmo que no mês anterior"
            : `${Math.round(Math.abs(recap.change) * 100)}% ${recap.change < 0 ? "a menos" : "a mais"} que no mês anterior`,
      foot: `${short(recap.perDay)} por dia, em média`,
    },
  ];
  if (recap.topCategory) {
    slides.push({
      key: "categoria",
      bg: "radial-gradient(80% 60% at 70% 20%, #8b5cf6, transparent 60%), linear-gradient(170deg, #2e1065, #09090b)",
      tag: "Onde mais foi o dinheiro",
      big: recap.topCategory.name,
      line: `${short(recap.topCategory.total)} · ${Math.round(recap.topCategory.share * 100)}% dos gastos`,
    });
  }
  if (recap.favorite) {
    slides.push({
      key: "favorito",
      bg: "radial-gradient(80% 60% at 20% 15%, #ea1d2c, transparent 60%), linear-gradient(170deg, #4c0519, #09090b)",
      tag: "Seu favorito",
      big: recap.favorite.name,
      line: `${recap.favorite.count} vezes · ${short(recap.favorite.total)}`,
    });
  }
  if (recap.priciestDay) {
    slides.push({
      key: "dia",
      bg: "radial-gradient(80% 60% at 70% 20%, #d97706, transparent 60%), linear-gradient(170deg, #451a03, #09090b)",
      tag: "Dia mais caro",
      big: dayLabel(recap.priciestDay.date),
      line: `${short(recap.priciestDay.total)} no dia`,
      foot: `Principalmente: ${recap.priciestDay.mainDescription}`,
    });
  }
  slides.push({
    key: "sobrou",
    bg:
      recap.saved >= 0
        ? "radial-gradient(90% 60% at 50% 15%, #34d399, transparent 60%), linear-gradient(170deg, #022c22, #09090b)"
        : "radial-gradient(90% 60% at 50% 15%, #e11d48, transparent 60%), linear-gradient(170deg, #4c0519, #09090b)",
    tag: recap.saved >= 0 ? "Sobrou no mês" : "Faltou no mês",
    big: short(Math.abs(recap.saved)),
    line: recap.saved >= 0 ? "Entrou mais do que saiu. Muito bem!" : "Saiu mais do que entrou neste mês.",
    foot: `Entrou ${short(recap.income)} · saiu ${short(recap.spent)}`,
  });
  return slides;
}

function shareText(recap: MonthRecap): string {
  const name = monthName(recap.monthKey);
  const parts = [`Meu ${name} em números: gastei ${short(recap.spent)}`];
  if (recap.change !== null && Math.abs(recap.change) >= 0.03) parts.push(`${Math.round(Math.abs(recap.change) * 100)}% ${recap.change < 0 ? "a menos" : "a mais"} que no mês anterior`);
  if (recap.topCategory) parts.push(`mais em ${recap.topCategory.name}`);
  parts.push(recap.saved >= 0 ? `e sobrou ${short(recap.saved)}` : `e faltaram ${short(-recap.saved)}`);
  return `${parts.join(", ")}. (Meu Financeiro IA)`;
}

export default function RecapStories({ recap, isCurrentMonth, months }: { recap: MonthRecap; isCurrentMonth: boolean; months: string[] }) {
  const router = useRouter();
  const slides = slidesFor(recap, isCurrentMonth);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [shared, setShared] = useState<string | null>(null);
  const holdTimer = useRef<number | null>(null);
  const wasHold = useRef(false);
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Avança sozinho (a barra de progresso dispara o próximo ao terminar).
  const go = (next: number) => setIndex(Math.max(0, Math.min(slides.length - 1, next)));

  async function share() {
    const text = shareText(recap);
    try {
      if (navigator.share) {
        await navigator.share({ title: `Minha retrospectiva de ${monthName(recap.monthKey)}`, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setShared("Texto copiado. É só colar no WhatsApp.");
    } catch {
      setShared(null);
    }
  }

  const slide = slides[index];
  const last = index === slides.length - 1;

  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 pb-10 pt-2">
        <div className="flex w-full items-center justify-between gap-3">
          <h1 className="text-sm font-medium text-zinc-300">Retrospectiva</h1>
          <select
            aria-label="Mês da retrospectiva"
            value={recap.monthKey}
            onChange={(event) => router.push(`/retrospectiva?mes=${event.target.value}`)}
            className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {cap(monthName(m))} {m.slice(0, 4)}
                {m === months[0] ? " (até agora)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div
          role="region"
          aria-label={`Retrospectiva de ${monthName(recap.monthKey)}, tela ${index + 1} de ${slides.length}`}
          tabIndex={0}
          className="relative aspect-[9/16] max-h-[72vh] w-full max-w-[340px] cursor-pointer select-none overflow-hidden rounded-[28px] text-white shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          style={{ background: slide.bg }}
          onPointerDown={() => {
            wasHold.current = false;
            holdTimer.current = window.setTimeout(() => {
              wasHold.current = true;
              setPaused(true);
            }, 220);
          }}
          onPointerUp={(event) => {
            if (holdTimer.current) window.clearTimeout(holdTimer.current);
            if (wasHold.current) {
              setPaused(false);
              return;
            }
            const rect = event.currentTarget.getBoundingClientRect();
            go(event.clientX - rect.left < rect.width / 3 ? index - 1 : index + 1);
          }}
          onPointerLeave={() => {
            if (holdTimer.current) window.clearTimeout(holdTimer.current);
            setPaused(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") go(index + 1);
            if (event.key === "ArrowLeft") go(index - 1);
          }}
        >
          <div className="absolute inset-x-3 top-3 z-10 flex gap-1">
            {slides.map((s, i) => (
              <span key={s.key} className="h-[3px] flex-1 overflow-hidden rounded bg-white/30">
                <span
                  key={`${s.key}-${index}`}
                  className="block h-full bg-white"
                  style={
                    i < index
                      ? { width: "100%" }
                      : i === index && !last
                        ? {
                            width: "0%",
                            animation: `recap-fill ${DURATION_MS}ms linear forwards`,
                            animationPlayState: paused ? "paused" : "running",
                          }
                        : i === index
                          ? { width: "100%" }
                          : { width: "0%" }
                  }
                  onAnimationEnd={() => {
                    if (!reduce.current) go(index + 1);
                  }}
                />
              </span>
            ))}
          </div>
          <div key={slide.key} className="recap-in absolute inset-0 flex flex-col justify-end gap-1.5 px-6 pb-8 pt-12">
            {slide.art && <div className="grid flex-1 place-items-center text-7xl opacity-90">{slide.art}</div>}
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">{slide.tag}</p>
            <p className="text-[44px] font-extrabold leading-none tracking-tight">{slide.big}</p>
            {slide.line && <p className="text-lg font-semibold leading-snug">{slide.line}</p>}
            {slide.foot && <p className="text-sm text-white/75">{slide.foot}</p>}
          </div>
        </div>

        <p className="text-center text-xs text-zinc-500">Toque na direita para avançar, na esquerda para voltar. Segure para pausar.</p>
        <button
          type="button"
          onClick={() => void share()}
          className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
        >
          Compartilhar
        </button>
        {shared && <p className="text-xs text-emerald-300">{shared}</p>}
      </div>
    </PageShell>
  );
}
