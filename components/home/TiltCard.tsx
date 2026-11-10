"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Cartão da carteira em 3D: inclina com o movimento do celular (sensor de
 * orientação) ou com o dedo/mouse, com um reflexo holográfico. Uma única
 * escuta do sensor serve a todos os cartões. Sem efeito com "reduzir movimento".
 */
type Tilt = { x: number; y: number };
const listeners = new Set<(tilt: Tilt) => void>();
let listening = false;

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

function startOrientation() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  let base: { beta: number; gamma: number } | null = null;
  window.addEventListener(
    "deviceorientation",
    (event) => {
      if (event.beta == null || event.gamma == null) return;
      if (!base) base = { beta: event.beta, gamma: event.gamma };
      // A posição "de repouso" acompanha devagar o jeito que a pessoa segura o celular.
      base.beta += (event.beta - base.beta) * 0.02;
      base.gamma += (event.gamma - base.gamma) * 0.02;
      const tilt = { x: clamp((event.gamma - base.gamma) / 22), y: clamp((event.beta - base.beta) / 22) };
      listeners.forEach((listener) => listener(tilt));
    },
    { passive: true },
  );
}

type OrientationPermission = { requestPermission?: () => Promise<"granted" | "denied"> };

/** iPhone pede permissão para o sensor; só pode ser pedida num toque. */
function askOrientationPermission() {
  const ctor = (typeof window !== "undefined" ? window.DeviceOrientationEvent : undefined) as unknown as OrientationPermission | undefined;
  if (!ctor?.requestPermission) return;
  ctor.requestPermission().then((state) => { if (state === "granted") startOrientation(); }).catch(() => undefined);
}

export function TiltCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const inner = useRef<HTMLDivElement>(null);
  const shine = useRef<HTMLSpanElement>(null);
  const touching = useRef(false);

  function apply(x: number, y: number, strength = 1) {
    const element = inner.current;
    const light = shine.current;
    if (!element || !light) return;
    element.style.transform = `rotateX(${(-y * 10 * strength).toFixed(2)}deg) rotateY(${(x * 13 * strength).toFixed(2)}deg)`;
    const px = 50 + x * 50, py = 50 + y * 50;
    light.style.opacity = String(0.35 + Math.min(1, Math.hypot(x, y)) * 0.65);
    light.style.background = `radial-gradient(circle at ${px}% ${py}%, rgba(255,255,255,.38), rgba(255,255,255,.05) 38%, transparent 62%), linear-gradient(${115 + x * 40}deg, transparent 32%, rgba(160,255,230,.14) 46%, rgba(190,160,255,.14) 56%, transparent 70%)`;
  }

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const listener = (tilt: Tilt) => { if (!touching.current) apply(tilt.x, tilt.y, 0.8); };
    listeners.add(listener);
    const ctor = window.DeviceOrientationEvent as unknown as OrientationPermission | undefined;
    if (!ctor?.requestPermission) startOrientation();
    return () => { listeners.delete(listener); };
  }, []);

  return (
    <div
      className={`shrink-0 [perspective:900px] ${className}`}
      onPointerDown={askOrientationPermission}
      onPointerMove={(event) => {
        if (event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        touching.current = true;
        const rect = event.currentTarget.getBoundingClientRect();
        apply(((event.clientX - rect.left) / rect.width) * 2 - 1, ((event.clientY - rect.top) / rect.height) * 2 - 1);
      }}
      onPointerLeave={() => {
        touching.current = false;
        apply(0, 0, 0);
        if (shine.current) shine.current.style.opacity = "0";
      }}
    >
      <div ref={inner} className="relative transition-transform duration-200 ease-out [transform-style:preserve-3d]">
        {children}
        <span
          ref={shine}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[28px] opacity-0 mix-blend-screen transition-opacity duration-300"
        />
      </div>
    </div>
  );
}
