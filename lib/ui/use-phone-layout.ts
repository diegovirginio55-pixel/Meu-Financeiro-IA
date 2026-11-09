"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import { isPhoneUserAgent } from "@/lib/ui/phone-ua";

/** Valor calculado no servidor a partir do user-agent (app/(app)/layout.tsx → AppChrome). */
export const PhoneLayoutContext = createContext(false);

const NARROW_TOUCH = "(pointer: coarse) and (max-width: 767.98px)";

function computeIsPhone() {
  if (isPhoneUserAgent(navigator.userAgent)) return true;
  return window.matchMedia(NARROW_TOUCH).matches;
}

function subscribe(callback: () => void) {
  const mq = window.matchMedia(NARROW_TOUCH);
  mq.addEventListener("change", callback);
  window.addEventListener("resize", callback);
  return () => {
    mq.removeEventListener("change", callback);
    window.removeEventListener("resize", callback);
  };
}

/**
 * No computador (mouse/Chrome desktop) fica false, mesmo com a janela estreita.
 * O servidor já renderiza o layout certo (pelo user-agent); no cliente refina com matchMedia/resize.
 */
export function usePhoneLayout() {
  const initialPhone = useContext(PhoneLayoutContext);
  const getServerSnapshot = useCallback(() => initialPhone, [initialPhone]);
  return useSyncExternalStore(subscribe, computeIsPhone, getServerSnapshot);
}
