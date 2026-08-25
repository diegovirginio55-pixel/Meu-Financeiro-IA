"use client";

import { useEffect, useRef, useState } from "react";

const HOLD_MS = 2300;
const FADE_MS = 550;
const RESUME_THRESHOLD_MS = 8000;

const EQ_BARS = [
  { delay: "0ms", duration: "820ms" },
  { delay: "120ms", duration: "760ms" },
  { delay: "60ms", duration: "900ms" },
  { delay: "200ms", duration: "700ms" },
  { delay: "150ms", duration: "860ms" },
];

export default function IntroSplash() {
  const [phase, setPhase] = useState<"visible" | "leaving" | "done">("visible");
  const [runId, setRunId] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hiddenAt = useRef<number | null>(null);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function play() {
    clearTimers();
    setPhase("visible");
    setRunId((id) => id + 1);
    timers.current.push(setTimeout(() => setPhase("leaving"), HOLD_MS));
    timers.current.push(setTimeout(() => setPhase("done"), HOLD_MS + FADE_MS));
  }

  useEffect(() => {
    play();

    // Apps instalados (Android/iOS) costumam "retomar" a sessão em vez de recarregar a
    // página quando o usuário reabre pelo ícone. Detectamos isso pela troca de
    // visibilidade e voltamos a mostrar a intro quando o app ficou em segundo plano por
    // um tempo (abertura "de verdade"), sem repetir em trocas rápidas de app.
    function handleVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        return;
      }
      const since = hiddenAt.current;
      hiddenAt.current = null;
      if (since != null && Date.now() - since > RESUME_THRESHOLD_MS) {
        play();
      }
    }

    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) play();
    }

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      clearTimers();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  if (phase === "done") return null;

  return (
    <div
      key={runId}
      aria-hidden
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-7 bg-zinc-950 transition-opacity duration-500 ease-out ${
        phase === "leaving" ? "opacity-0" : "opacity-100"
      }`}
    >
      <div
        className="intro-anim pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(circle at 50% 38%, rgba(16,185,129,0.2), transparent 62%)",
          animation: "intro-pulse 3.2s ease-in-out infinite",
        }}
      />

      <div className="relative flex h-44 w-44 items-center justify-center">
        <div
          className="intro-anim absolute inset-0 rounded-full opacity-80 blur-[2px]"
          style={{
            background:
              "conic-gradient(from 0deg, rgba(16,185,129,0) 0deg, rgba(16,185,129,0.9) 90deg, rgba(34,211,238,0.85) 180deg, rgba(16,185,129,0) 260deg, rgba(16,185,129,0) 360deg)",
            animation: "intro-spin 2.8s linear infinite",
          }}
        />
        <div
          className="intro-anim absolute rounded-full opacity-60 blur-[1px]"
          style={{
            inset: "10px",
            background:
              "conic-gradient(from 180deg, rgba(34,211,238,0) 0deg, rgba(34,211,238,0.7) 110deg, rgba(16,185,129,0) 200deg)",
            animation: "intro-spin-reverse 3.6s linear infinite",
          }}
        />
        <div className="absolute rounded-full bg-zinc-950" style={{ inset: "22px" }} />

        <img
          src="/logo.png?v=2"
          alt=""
          width={92}
          height={92}
          className="intro-anim relative h-[5.75rem] w-[5.75rem] rounded-[1.6rem]"
          style={{ animation: "intro-breathe 2.2s ease-in-out infinite" }}
        />
      </div>

      <div
        className="intro-anim flex flex-col items-center gap-1.5"
        style={{ animation: "intro-fade-up 650ms ease-out 200ms both" }}
      >
        <span className="text-[11px] font-medium uppercase tracking-[0.35em] text-emerald-400/90">
          Meu Financeiro
        </span>
        <span className="text-2xl font-semibold tracking-tight text-white">IA</span>
      </div>

      <div
        className="intro-anim flex items-end gap-1.5"
        style={{ animation: "intro-fade-up 650ms ease-out 350ms both" }}
      >
        {EQ_BARS.map((bar, index) => (
          <span
            key={index}
            className="intro-anim block h-6 w-1.5 origin-bottom rounded-full bg-gradient-to-t from-emerald-500 to-cyan-300"
            style={{ animation: `intro-eq ${bar.duration} ease-in-out ${bar.delay} infinite` }}
          />
        ))}
      </div>

      <div className="relative mt-1 h-1 w-40 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="intro-anim h-full w-full origin-left rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
          style={{ animation: `intro-bar ${HOLD_MS - 150}ms ease-in-out 150ms both` }}
        />
      </div>
    </div>
  );
}
