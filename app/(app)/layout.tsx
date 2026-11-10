import { cookies, headers } from "next/headers";
import AppChrome from "@/components/nav/AppChrome";
import { isPhoneUserAgent } from "@/lib/ui/phone-ua";
import { HIDE_VALUES_COOKIE, hideValuesFromCookie } from "@/lib/ui/ui-prefs";

/** Mesmo nome de lib/ui/app-lock.ts (LOCK_COOKIE), que é um módulo só do navegador. */
const LOCK_COOKIE = "mf-app-lock";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [headerList, cookieJar] = await Promise.all([headers(), cookies()]);
  // Calculado no servidor para o HTML já sair com o layout certo (celular x computador), sem erro de hidratação.
  const initialPhone = isPhoneUserAgent(headerList.get("user-agent"));
  // "Ocultar valores": o HTML do servidor já sai mascarado.
  const initialHideValues = hideValuesFromCookie(cookieJar.get(HIDE_VALUES_COOKIE)?.value);
  // Bloqueio com digital ligado neste aparelho: nenhuma tela é montada antes do desbloqueio.
  const lockEnabled = cookieJar.get(LOCK_COOKIE)?.value === "1";

  return (
    <AppChrome initialPhone={initialPhone} initialHideValues={initialHideValues} lockEnabled={lockEnabled}>
      {children}
    </AppChrome>
  );
}
