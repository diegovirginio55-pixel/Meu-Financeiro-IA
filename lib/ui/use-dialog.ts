"use client";

import { useEffect, useEffectEvent, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Comportamento básico de modal para um componente que só é montado quando o modal está aberto:
 * foco inicial (no elemento com `data-autofocus` ou no primeiro focável), Esc fecha e,
 * ao fechar, o foco volta para onde estava. Use o ref no elemento com role="dialog".
 */
export function useDialog<T extends HTMLElement = HTMLDivElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  const close = useEffectEvent(() => onClose());

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = ref.current;
    const target =
      node?.querySelector<HTMLElement>("[data-autofocus]") ?? node?.querySelector<HTMLElement>(FOCUSABLE) ?? node;
    target?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      close();
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      if (previous && document.contains(previous)) previous.focus();
    };
  }, []);

  return ref;
}
