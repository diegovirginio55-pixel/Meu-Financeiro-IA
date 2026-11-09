import { cookies, headers } from "next/headers";
import AppChrome from "@/components/nav/AppChrome";
import { isPhoneUserAgent } from "@/lib/ui/phone-ua";
import { HIDE_VALUES_COOKIE, hideValuesFromCookie } from "@/lib/ui/ui-prefs";

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

  return (
    <AppChrome initialPhone={initialPhone} initialHideValues={initialHideValues}>
      {children}
    </AppChrome>
  );
}
