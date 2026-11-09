"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Pequena camada sobre o localStorage para usar com useSyncExternalStore:
 * - o servidor (e a hidratação) sempre veem `null`, então não há diferença de HTML;
 * - escritas nesta aba avisam todos os componentes que leem a mesma chave;
 * - o evento "storage" mantém outras abas sincronizadas;
 * - se o localStorage falhar (modo privado, cota), guarda em memória.
 */

const LOCAL_EVENT = "mf-local-store";
const memory = new Map<string, string | null>();

export function readStored(key: string): string | null {
  if (typeof window === "undefined") return null;
  if (memory.has(key)) return memory.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  memory.set(key, value);
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
    // Gravou de verdade: a fonte passa a ser o localStorage (permite sincronizar com outras abas).
    memory.delete(key);
  } catch {
    /* fica só em memória nesta aba */
  }
  window.dispatchEvent(new CustomEvent<string>(LOCAL_EVENT, { detail: key }));
}

export function subscribeStored(key: string, callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== key) return;
    memory.delete(key);
    callback();
  };
  const onLocal = (event: Event) => {
    if ((event as CustomEvent<string>).detail === key) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(LOCAL_EVENT, onLocal);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LOCAL_EVENT, onLocal);
  };
}

const getServerNull = () => null;

/** Valor bruto (string) de uma chave do localStorage; `null` no servidor e durante a hidratação. */
export function useStoredString(key: string): string | null {
  const subscribe = useCallback((callback: () => void) => subscribeStored(key, callback), [key]);
  const getSnapshot = useCallback(() => readStored(key), [key]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerNull);
}

const noopSubscribe = () => () => undefined;

/** `false` no servidor e durante a hidratação; `true` depois (ou direto, em navegação no cliente). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
