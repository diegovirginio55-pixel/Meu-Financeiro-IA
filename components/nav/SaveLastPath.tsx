"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isAppPath, writeLastPath } from "@/lib/ui/nav-memory";

export default function SaveLastPath() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname && isAppPath(pathname)) writeLastPath(pathname);
  }, [pathname]);

  return null;
}
