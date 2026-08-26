"use client";

import { useTheme } from "@/components/theme/ThemeProvider";

function SunIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 3.5v1.8M12 18.7v1.8M3.5 12h1.8M18.7 12h1.8M6.05 6.05l1.27 1.27M16.68 16.68l1.27 1.27M17.95 6.05l-1.27 1.27M7.32 16.68l-1.27 1.27"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M16.8 13.2A6.4 6.4 0 0 1 10.8 4a6.8 6.8 0 1 0 8.4 9.8 5.2 5.2 0 0 1-2.4-.6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ThemeToggle({ variant = "icon" }: { variant?: "icon" | "nav" | "menu" }) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";
  const label = isLight ? "Tema escuro" : "Tema claro";

  if (variant === "menu") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-[15px] hover:bg-zinc-900"
      >
        <span>{label}</span>
        <span className="text-zinc-400">{isLight ? <MoonIcon /> : <SunIcon />}</span>
      </button>
    );
  }

  if (variant === "nav") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className="text-sm text-zinc-500 hover:text-zinc-200"
        aria-label={label}
      >
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full text-zinc-300 hover:text-white"
    >
      {isLight ? <MoonIcon className="h-7 w-7" /> : <SunIcon className="h-7 w-7" />}
    </button>
  );
}
