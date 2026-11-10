"use client";

/**
 * Bloqueio do app com digital / Face ID / PIN do aparelho (WebAuthn com o
 * autenticador do próprio celular). É uma trava de tela: quem pegar o
 * celular desbloqueado não vê o seu dinheiro. O login da conta continua
 * sendo a proteção dos dados no servidor.
 *
 * Fica só neste aparelho (localStorage): cada celular ativa o seu.
 */
const CONFIG_KEY = "mf-app-lock-v1";
/** Cookie lido pelo servidor: com o bloqueio ligado, o HTML das telas só sai depois do desbloqueio. */
export const LOCK_COOKIE = "mf-app-lock";

export function setLockCookie(on: boolean) {
  try {
    document.cookie = on
      ? `${LOCK_COOKIE}=1; Path=/; Max-Age=31536000; SameSite=Lax; Secure`
      : `${LOCK_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; Secure`;
  } catch {
    // ignore
  }
}
const UNLOCKED_KEY = "mf-app-unlocked-at";
/** Voltar ao app depois de 2 min fora pede a digital de novo. */
export const RELOCK_AFTER_MS = 2 * 60 * 1000;

type LockConfig = { credentialId: string };

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomBytes(size: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(size));
  crypto.getRandomValues(bytes);
  return bytes;
}

export function readLockConfig(): LockConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LockConfig;
    return typeof parsed.credentialId === "string" && parsed.credentialId ? parsed : null;
  } catch {
    return null;
  }
}

export async function lockSupported(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !window.PublicKeyCredential || !window.isSecureContext) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** Cadastra a digital deste aparelho (o celular pede a digital/PIN). */
export async function enableLock(): Promise<void> {
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: "Meu Financeiro", id: location.hostname },
      user: { id: randomBytes(16), name: "meu-financeiro", displayName: "Meu Financeiro" },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("cancelado");
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ credentialId: toBase64Url(credential.rawId) } satisfies LockConfig));
  setLockCookie(true);
  markUnlocked();
}

export function disableLock() {
  try {
    localStorage.removeItem(CONFIG_KEY);
  } catch {
    // ignore
  }
  setLockCookie(false);
}

/** Pede a digital/Face ID/PIN do aparelho. true = conferiu. */
export async function verifyUser(): Promise<boolean> {
  const config = readLockConfig();
  if (!config) return true;
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        rpId: location.hostname,
        allowCredentials: [{ type: "public-key", id: fromBase64Url(config.credentialId) }],
        userVerification: "required",
        timeout: 60_000,
      },
    });
    if (!assertion) return false;
    markUnlocked();
    return true;
  } catch {
    return false;
  }
}

export function markUnlocked() {
  try {
    sessionStorage.setItem(UNLOCKED_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

/** Já desbloqueou nesta sessão do app (a sessão some quando o app é fechado). */
export function unlockedThisSession(): boolean {
  try {
    return Boolean(sessionStorage.getItem(UNLOCKED_KEY));
  } catch {
    return false;
  }
}
