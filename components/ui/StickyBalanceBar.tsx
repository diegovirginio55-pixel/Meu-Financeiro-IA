"use client";

import { useEffect, useState } from "react";

const SHOW_AFTER_PX = 340;

export function StickyBalanceBar({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > SHOW_AFTER_PX);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-center px-4 pt-3 transition-all duration-200 ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
      }`}
    >
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-zinc-800 bg-zinc-950/90 px-4 py-2 shadow-xl backdrop-blur">
        <span className="text-xs text-zinc-500">{label}</span>
        <span className="text-sm font-semibold text-white">{value}</span>
      </div>
    </div>
  );
}
