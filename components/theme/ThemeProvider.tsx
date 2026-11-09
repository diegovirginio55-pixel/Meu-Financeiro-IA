"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import { readStored, subscribeStored, useHydrated, writeStored } from "@/lib/ui/browser-store";

export type Theme = "dark" | "light";

const STORAGE_KEY = "mf-theme";

function readTheme(): Theme {
  return readStored(STORAGE_KEY) === "light" ? "light" : "dark";
}

function subscribeTheme(callback: () => void) {
  return subscribeStored(STORAGE_KEY, callback);
}

const getServerTheme = (): Theme => "dark";

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f4f4f5" : "#09090b");
}

const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void }>({
  theme: "dark",
  toggleTheme: () => undefined,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // O script "theme-init" (app/layout.tsx) já aplica a classe antes da pintura; aqui só lemos o valor salvo.
  const theme = useSyncExternalStore(subscribeTheme, readTheme, getServerTheme);
  const hydrated = useHydrated();

  // Sincroniza o DOM (classe, color-scheme e meta theme-color) com o tema atual — inclusive vindo de outra aba.
  // Na hidratação o valor ainda é o do servidor ("dark"); não aplica para não desfazer o tema claro do script.
  useEffect(() => {
    if (hydrated) applyTheme(theme);
  }, [theme, hydrated]);

  const toggleTheme = useCallback(() => {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    writeStored(STORAGE_KEY, next);
    applyTheme(next);
  }, []);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
