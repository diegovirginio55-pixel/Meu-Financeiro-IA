"use client";

import { useEffect, useRef, useState } from "react";

const HOLD_MS = 3400;
const FADE_MS = 600;
const RESUME_THRESHOLD_MS = 8000;
const MESSAGE_MS = 680;

const MESSAGES = [
  "Conectando aos seus bancos…",
  "Calculando seu patrimônio…",
  "Organizando seus gastos…",
  "Atualizando seus investimentos…",
  "Quase pronto…",
];

const EQ_BARS = [
  { delay: "0ms", duration: "820ms" },
  { delay: "120ms", duration: "760ms" },
  { delay: "60ms", duration: "900ms" },
  { delay: "200ms", duration: "700ms" },
  { delay: "150ms", duration: "860ms" },
];

const PARTICLES = [
  { top: "18%", left: "22%", size: "6px", delay: "0ms", duration: "3.4s" },
  { top: "28%", left: "78%", size: "5px", delay: "500ms", duration: "3.8s" },
  { top: "72%", left: "18%", size: "4px", delay: "900ms", duration: "3.1s" },
  { top: "78%", left: "80%", size: "6px", delay: "300ms", duration: "3.6s" },
  { top: "12%", left: "52%", size: "4px", delay: "700ms", duration: "4s" },
];

export default function IntroSplash() {
  const [phase, setPhase] = useState<"visible" | "leaving" | "done">("visible");
  const [runId, setRunId] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const messageTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hiddenAt = useRef<number | null>(null);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (messageTimer.current) {
      clearInterval(messageTimer.current);
      messageTimer.current = null;
    }
  }

  function play() {
    clearTimers();
    setPhase("visible");
    setMessageIndex(0);
    setRunId((id) => id + 1);
    timers.current.push(setTimeout(() => setPhase("leaving"), HOLD_MS));
    timers.current.push(setTimeout(() => setPhase("done"), HOLD_MS + FADE_MS));
    messageTimer.current = setInterval(() => {
      setMessageIndex((index) => Math.min(index + 1, MESSAGES.length - 1));
    }, MESSAGE_MS);
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
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 overflow-hidden bg-zinc-950 transition-opacity ease-out ${
        phase === "leaving" ? "opacity-0" : "opacity-100"
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <div
        className="intro-anim pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(circle at 50% 34%, rgba(16,185,129,0.22), transparent 60%)",
          animation: "intro-pulse 3.2s ease-in-out infinite",
        }}
      />
      <div
        className="intro-anim pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(circle at 70% 75%, rgba(34,211,238,0.14), transparent 55%)",
          animation: "intro-pulse 4.4s ease-in-out infinite 400ms",
        }}
      />

      {PARTICLES.map((particle, index) => (
        <span
          key={index}
          className="intro-anim pointer-events-none absolute rounded-full bg-emerald-300"
          style={{
            top: particle.top,
            left: particle.left,
            width: particle.size,
            height: particle.size,
            animation: `intro-float ${particle.duration} ease-in-out ${particle.delay} infinite`,
          }}
        />
      ))}

      <div className="relative flex h-72 w-72 items-center justify-center">
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
            inset: "14px",
            background:
              "conic-gradient(from 180deg, rgba(34,211,238,0) 0deg, rgba(34,211,238,0.7) 110deg, rgba(16,185,129,0) 200deg)",
            animation: "intro-spin-reverse 3.6s linear infinite",
          }}
        />
        <div className="absolute rounded-full bg-zinc-950" style={{ inset: "34px" }} />

        <img
          src="/logo.png?v=2"
          alt=""
          width={160}
          height={160}
          className="intro-anim relative h-40 w-40 rounded-[2.4rem]"
          style={{ animation: "intro-breathe 2.2s ease-in-out infinite" }}
        />
      </div>

      <div
        className="intro-anim flex flex-col items-center gap-2"
        style={{ animation: "intro-fade-up 650ms ease-out 200ms both" }}
      >
        <span className="text-sm font-medium uppercase tracking-[0.4em] text-emerald-400/90">
          Meu Financeiro
        </span>
        <span className="text-6xl font-bold tracking-tight text-white">IA</span>
        <span className="mt-1 text-sm text-zinc-400">Sua vida financeira, organizada.</span>
      </div>

      <div
        className="intro-anim flex items-end gap-2"
        style={{ animation: "intro-fade-up 650ms ease-out 350ms both" }}
      >
        {EQ_BARS.map((bar, index) => (
          <span
            key={index}
            className="intro-anim block h-8 w-2 origin-bottom rounded-full bg-gradient-to-t from-emerald-500 to-cyan-300"
            style={{ animation: `intro-eq ${bar.duration} ease-in-out ${bar.delay} infinite` }}
          />
        ))}
      </div>

      <div
        className="intro-anim flex flex-col items-center gap-2.5"
        style={{ animation: "intro-fade-up 650ms ease-out 450ms both" }}
      >
        <span
          key={messageIndex}
          className="intro-anim min-w-[15rem] text-center text-xs text-zinc-400"
          style={{ animation: "intro-msg 350ms ease-out both" }}
        >
          {MESSAGES[messageIndex]}
        </span>
        <div className="relative h-1.5 w-56 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="intro-anim h-full w-full origin-left rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
            style={{ animation: `intro-bar ${HOLD_MS - 150}ms ease-in-out 150ms both` }}
          />
        </div>
      </div>
    </div>
  );
}
