"use client";

import { useEffect, useRef } from "react";

/**
 * Pote do orçamento do mês: o líquido é o que ainda resta do limite, baixa
 * conforme você gasta e muda de cor (verde → âmbar → vermelho). Balança
 * quando o celular inclina (ou com o dedo/mouse por cima).
 */
export function BudgetJar({ remaining }: { remaining: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const target = useRef(remaining);
  const tiltTarget = useRef(0);

  useEffect(() => {
    target.current = Math.max(0, Math.min(1, remaining));
  }, [remaining]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const W = canvas.width, H = canvas.height;
    let level = reduce ? target.current : 0;
    let tilt = 0;
    let frame = 0;
    let visible = true;
    const bubbles = Array.from({ length: 9 }, () => ({ x: Math.random(), y: Math.random(), r: 2 + Math.random() * 3, s: 0.2 + Math.random() * 0.5 }));

    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma != null) tiltTarget.current = Math.max(-0.9, Math.min(0.9, event.gamma / 45));
    };
    if (!reduce) window.addEventListener("deviceorientation", onOrientation, { passive: true });
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    observer.observe(canvas);

    const jarPath = () => {
      const x = 20, y = 46, w = W - 40, h = H - 66, r = 34;
      ctx.beginPath();
      ctx.moveTo(x + 36, y - 30);
      ctx.lineTo(x + w - 36, y - 30);
      ctx.lineTo(x + w - 36, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + 36, y);
      ctx.closePath();
      return { x, y, w, h };
    };

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (!visible) return;
      level += (target.current - level) * 0.06;
      tilt += (tiltTarget.current - tilt) * 0.08;
      ctx.clearRect(0, 0, W, H);
      const box = jarPath();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(0, 0, W, H);
      const color = level > 0.5 ? "#10b981" : level > 0.2 ? "#d97706" : "#e11d48";
      const surface = box.y + box.h - level * box.h;
      const t = reduce ? 0 : now / 600;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let px = 0; px <= W; px += 5) {
        ctx.lineTo(px, surface + Math.sin(px / 26 + t) * (reduce ? 2 : 6) + Math.sin(px / 15 - t * 1.3) * 2 + (px - W / 2) * tilt * 0.45);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      const gradient = ctx.createLinearGradient(0, surface, 0, H);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, "rgba(0,0,0,0.5)");
      ctx.fillStyle = gradient;
      ctx.globalAlpha = 0.92;
      ctx.fill();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = "#ffffff";
      for (const b of bubbles) {
        if (!reduce) {
          b.y -= b.s / 300;
          if (b.y < 0) b.y = 1;
        }
        const by = surface + b.y * (H - surface);
        if (by > surface + 8) {
          ctx.beginPath();
          ctx.arc(20 + b.x * (W - 40), by, b.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      jarPath();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(161,161,170,0.45)";
      ctx.stroke();
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("deviceorientation", onOrientation);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={220}
      height={300}
      aria-hidden
      className="h-[150px] w-[110px] shrink-0 touch-pan-y"
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        tiltTarget.current = ((event.clientX - rect.left) / rect.width - 0.5) * 0.9;
      }}
      onPointerLeave={() => { tiltTarget.current = 0; }}
    />
  );
}
