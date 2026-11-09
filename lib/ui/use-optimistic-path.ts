"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

export function useOptimisticPath() {
  const pathname = usePathname() ?? "";
  // Guarda de qual rota saiu o clique: quando a rota muda, o "pendente" deixa de valer sozinho
  // (derivado no render, sem efeito para limpar).
  const [pending, setPending] = useState<{ href: string; from: string } | null>(null);

  function onNavigate(href: string) {
    if (href !== pathname) setPending({ href, from: pathname });
  }

  const path = pending && pending.from === pathname ? pending.href : pathname;
  return { path, onNavigate };
}

export function isActivePath(path: string, href: string) {
  if (href === "/dashboard") return path === "/dashboard";
  return path === href || path.startsWith(`${href}/`);
}
