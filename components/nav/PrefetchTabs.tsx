"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const ROUTES = ["/dashboard", "/mes", "/visao", "/detalhes", "/chat", "/bancos", "/fluxo", "/ativos"];

export default function PrefetchTabs() {
  const router = useRouter();

  useEffect(() => {
    const prefetch = () => {
      ROUTES.forEach((href) => router.prefetch(href));
    };

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(prefetch, { timeout: 1200 });
      return () => window.cancelIdleCallback(id);
    }

    const timer = window.setTimeout(prefetch, 200);
    return () => window.clearTimeout(timer);
  }, [router]);

  return null;
}
