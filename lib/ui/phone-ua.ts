// Sem "use client": usado no servidor (app/(app)/layout.tsx) e no cliente (use-phone-layout).

const MOBILE_UA = /iPhone|iPod|Android.+Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i;

/** Celular pelo user-agent (mesma regra no servidor e no navegador). */
export function isPhoneUserAgent(userAgent: string | null | undefined): boolean {
  return MOBILE_UA.test(userAgent ?? "");
}
