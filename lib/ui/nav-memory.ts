export const APP_PATHS = [
  "/dashboard",
  "/visao",
  "/detalhes",
  "/fluxo",
  "/chat",
  "/ativos",
  "/bancos",
] as const;

export const LAST_PATH_KEY = "mf-last-path";
export const LAST_PATH_COOKIE = "mf-last-path";

export function isAppPath(path: string): path is (typeof APP_PATHS)[number] {
  return (APP_PATHS as readonly string[]).includes(path);
}

export function lastPathFromCookie(value: string | undefined): string {
  if (!value) return "/dashboard";
  try {
    const path = decodeURIComponent(value);
    return isAppPath(path) ? path : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

export function readLastPath(): string {
  if (typeof window === "undefined") return "/dashboard";
  try {
    const path = window.localStorage.getItem(LAST_PATH_KEY) ?? "";
    if (isAppPath(path)) return path;
  } catch {
    /* ignore */
  }
  return "/dashboard";
}

export function writeLastPath(path: string) {
  if (!isAppPath(path)) return;
  try {
    window.localStorage.setItem(LAST_PATH_KEY, path);
    document.cookie = `${LAST_PATH_COOKIE}=${encodeURIComponent(path)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}
