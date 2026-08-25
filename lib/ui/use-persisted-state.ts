"use client";

import { useEffect, useState } from "react";

export function usePersistedState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value, ready]);

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
