"use client";

import { useCallback, useEffect, useMemo } from "react";
import { readStored, useHydrated, useStoredString, writeStored } from "@/lib/ui/browser-store";

function parseStored<T>(raw: string | null, fallback: T): T {
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Estado salvo no localStorage. No servidor e na hidratação usa `fallback` (sem erro de hidratação);
 * logo depois assume o valor salvo. `ready` indica que o valor salvo já foi lido.
 * Componentes que usam a mesma chave ficam sincronizados (inclusive entre abas).
 */
export function usePersistedState<T>(key: string, fallback: T) {
  const raw = useStoredString(key);
  const ready = useHydrated();
  const value = useMemo(() => parseStored(raw, fallback), [raw, fallback]);

  const setValue = useCallback(
    (next: T | ((previous: T) => T)) => {
      const previous = parseStored(readStored(key), fallback);
      const resolved = typeof next === "function" ? (next as (previous: T) => T)(previous) : next;
      writeStored(key, JSON.stringify(resolved));
    },
    [key, fallback],
  );

  return [value, setValue, ready] as const;
}

export function useConnectionFilter(connectionIds: string[]) {
  const [connectionId, setConnectionId] = usePersistedState("mf-connection-id", "all");

  useEffect(() => {
    if (connectionIds.length === 0) return;
    if (connectionId !== "all" && !connectionIds.includes(connectionId)) {
      setConnectionId("all");
    }
  }, [connectionId, connectionIds, setConnectionId]);

  const valid = connectionId === "all" || connectionIds.length === 0 || connectionIds.includes(connectionId);
  return [valid ? connectionId : "all", setConnectionId] as const;
}
