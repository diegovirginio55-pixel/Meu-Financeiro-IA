"use client";

/** Vibração curta (Android); no iPhone/computador simplesmente não faz nada. */
export function vibrate(ms = 18) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
  } catch {
    // sem vibração aqui
  }
}

/** Confetes por cima da tela por ~2,5 s (nada com "reduzir movimento"). */
export function fireConfetti() {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "9999" });
  document.body.appendChild(canvas);
  const ratio = window.devicePixelRatio || 1;
  const W = window.innerWidth, H = window.innerHeight;
  canvas.width = W * ratio;
  canvas.height = H * ratio;
  const ctx = canvas.getContext("2d");
  if (!ctx) { canvas.remove(); return; }
  ctx.scale(ratio, ratio);
  const colors = ["#34d399", "#8b5cf6", "#d97706", "#3b82f6", "#f4f4f5", "#fb7185"];
  const parts = Array.from({ length: 160 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3,
    y: H * 0.45,
    vx: (Math.random() - 0.5) * 12,
    vy: -Math.random() * 12 - 4,
    size: 5 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
    angle: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 0.3,
  }));
  const start = performance.now();
  const frame = (now: number) => {
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.25;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.spin;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (now - start < 2600) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
