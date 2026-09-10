"use client";

import { useEffect, useState } from "react";

const SEEN_KEY = "mf-onboarding-seen-v1";

const SLIDES = [
  {
    icon: "🏠",
    title: "Início",
    text: "Sua visão geral: saldo, gastos do dia/semana e a carteira de bancos conectados.",
  },
  {
    icon: "📊",
    title: "Meu mês",
    text: "Relatório automático do mês, sua nota de saúde financeira e um centro de alertas.",
  },
  {
    icon: "🧾",
    title: "Extrato",
    text: "Todos os lançamentos, com filtros, categorização em lote e exportação em PDF/CSV.",
  },
  {
    icon: "🔄",
    title: "Fluxo de caixa",
    text: "Sua previsão de saldo pros próximos dias, com contas e recebimentos futuros.",
  },
  {
    icon: "🎯",
    title: "Metas",
    text: "Crie metas de economia, acompanhe o progresso e veja o histórico de aportes.",
  },
  {
    icon: "💬",
    title: "Chat IA",
    text: "Fale naturalmente sobre gastos, saldo e dívidas — a IA registra tudo pra você.",
  },
  {
    icon: "💹 · 🏦",
    title: "Investimentos e Bancos",
    text: "Acompanhe seus investimentos e gerencie as conexões bancárias conectadas.",
  },
];

export function OnboardingModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- decide, ao montar, se já viu o tour
      if (!window.localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      // ignore
    }
  }, []);

  function close() {
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // ignore
    }
    setOpen(false);
  }

  if (!open) return null;

  const slide = SLIDES[step];
  const last = step === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-center shadow-2xl">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-3xl">
          {slide.icon}
        </span>
        <h2 className="mt-4 text-lg font-semibold text-white">{slide.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{slide.text}</p>

        <div className="mt-5 flex justify-center gap-1.5">
          {SLIDES.map((s, index) => (
            <span
              key={s.title}
              className={`h-1.5 w-1.5 rounded-full ${index === step ? "bg-emerald-400" : "bg-zinc-700"}`}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" onClick={close} className="text-sm text-zinc-500 hover:text-zinc-300">
            Pular
          </button>
          <button
            type="button"
            onClick={() => (last ? close() : setStep((s) => s + 1))}
            className="rounded-full bg-white px-5 py-2 text-sm font-medium text-zinc-950"
          >
            {last ? "Entendi" : "Próximo"}
          </button>
        </div>
      </div>
    </div>
  );
}
