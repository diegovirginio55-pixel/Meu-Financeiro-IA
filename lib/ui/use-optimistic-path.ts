"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function useOptimisticPath() {
  const pathname = usePathname() ?? "";
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    setPending(null);
  }, [pathname]);

  function onNavigate(href: string) {
    if (href !== pathname) setPending(href);
  }

  return { path: pending ?? pathname, onNavigate };
}

export function isActivePath(path: string, href: string) {
  if (href === "/dashboard") return path === "/dashboard";
  return path === href || path.startsWith(`${href}/`);
}
