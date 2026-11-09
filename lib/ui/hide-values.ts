"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import { readStored, subscribeStored, writeStored } from "@/lib/ui/browser-store";
import { HIDE_VALUES_COOKIE, HIDE_VALUES_KEY } from "@/lib/ui/ui-prefs";

/** Valor lido do cookie no servidor (app/(app)/layout.tsx → AppChrome). */
export const HideValuesContext = createContext(false);

function readCookie(): boolean {
  return document.cookie.split(";").some((part) => part.trim() === `${HIDE_VALUES_COOKIE}=1`);
}

function writeCookie(hidden: boolean) {
  try {
    document.cookie = hidden
      ? `${HIDE_VALUES_COOKIE}=1; Path=/; Max-Age=31536000; SameSite=Lax`
      : `${HIDE_VALUES_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

function readHidden(): boolean {
  const raw = readStored(HIDE_VALUES_KEY);
  if (raw != null) return raw === "true";
  return readCookie();
}

function subscribe(callback: () => void) {
  return subscribeStored(HIDE_VALUES_KEY, callback);
}

/**
 * Preferência "ocultar valores". O servidor usa o cookie (sem flash do saldo real);
 * no cliente o localStorage manda e o cookie acompanha. Sincroniza entre componentes e abas.
 */
export function useHideValues() {
  const initialHidden = useContext(HideValuesContext);
  const getServerSnapshot = useCallback(() => initialHidden, [initialHidden]);
  const hidden = useSyncExternalStore(subscribe, readHidden, getServerSnapshot);

  // Mantém o cookie igual ao valor salvo (inclusive para quem já tinha a preferência só no localStorage).
  useEffect(() => {
    if (readCookie() !== hidden) writeCookie(hidden);
  }, [hidden]);

  const setHidden = useCallback((next: boolean | ((previous: boolean) => boolean)) => {
    const resolved = typeof next === "function" ? next(readHidden()) : next;
    writeCookie(resolved);
    writeStored(HIDE_VALUES_KEY, JSON.stringify(resolved));
  }, []);

  return [hidden, setHidden] as const;
}
