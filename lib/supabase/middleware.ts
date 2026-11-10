import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { lastPathFromCookie } from "@/lib/ui/nav-memory";

const PUBLIC_PATHS = [
  "/login",
  "/api/bank/webhook",
  "/api/bank/cron",
  // Botões das notificações: autorizados por token assinado, não por sessão.
  "/api/push/action",
  // Notificações do banco vindas do celular (MacroDroid/Atalhos): token pessoal.
  "/api/ingest/notification",
  "/manifest.webmanifest",
  // Verificação do app Android (abre o site sem barra de endereço).
  "/.well-known",
  "/sw.js",
  "/opengraph-image",
  "/twitter-image",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * App pessoal: se ALLOWED_EMAILS estiver definida (lista separada por
 * vírgula), só esses e-mails entram. Protege mesmo que o cadastro público
 * do Supabase esteja ligado — a chave anon fica no navegador e qualquer um
 * poderia criar conta pela API e usar a cota do Gemini/Pluggy.
 */
function isAllowedEmail(email: string | undefined): boolean {
  const raw = process.env.ALLOWED_EMAILS;
  if (!raw) return true;
  const allowed = raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return true;
  return Boolean(email && allowed.includes(email.toLowerCase()));
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;
  let user = data.user;

  if (user && !isAllowedEmail(user.email)) {
    await supabase.auth.signOut();
    user = null;
    if (pathname.startsWith("/api/") && !isPublicPath(pathname)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (!isPublicPath(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("erro", "nao-autorizado");
      const redirect = NextResponse.redirect(url);
      supabaseResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
      return redirect;
    }
  }

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/" || pathname.startsWith("/login"))) {
    const url = request.nextUrl.clone();
    url.pathname = lastPathFromCookie(request.cookies.get("mf-last-path")?.value);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
