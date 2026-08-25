"use client";

import { useEffect, useRef, useState } from "react";

const HOLD_MS = 1300;
const FADE_MS = 450;
const RESUME_THRESHOLD_MS = 8000;

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
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-zinc-950 transition-opacity duration-500 ease-out ${
        phase === "leaving" ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,_rgba(16,185,129,0.18),_transparent_62%)]" />

      <div className="relative flex items-center justify-center">
        <div
          className="intro-anim absolute -inset-6 rounded-[2.2rem] bg-emerald-400/25 blur-2xl"
          style={{ animation: "intro-pulse 1.8s ease-in-out infinite" }}
        />
        <img
          src="/logo.png?v=2"
          alt=""
          width={96}
          height={96}
          className="intro-anim relative h-24 w-24 rounded-[1.7rem] shadow-[0_0_60px_rgba(16,185,129,0.45)]"
          style={{ animation: "intro-pop 700ms cubic-bezier(0.16,1,0.3,1) both" }}
        />
      </div>

      <div
        className="intro-anim flex flex-col items-center gap-1"
        style={{ animation: "intro-fade-up 600ms ease-out 220ms both" }}
      >
        <span className="text-[11px] font-medium uppercase tracking-[0.35em] text-emerald-400/90">
          Meu Financeiro
        </span>
        <span className="text-2xl font-semibold tracking-tight text-white">IA</span>
      </div>

      <div className="relative mt-1 h-1 w-32 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="intro-anim h-full w-full origin-left rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
          style={{ animation: "intro-bar 1.05s ease-in-out 150ms both" }}
        />
      </div>
    </div>
  );
}
