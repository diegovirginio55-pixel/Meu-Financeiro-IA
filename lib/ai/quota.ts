const PACIFIC = "America/Los_Angeles";
const SAO_PAULO = "America/Sao_Paulo";

export const CHAT_QUOTA_COOKIE = "mf-ai-quota";
export const CHAT_DAILY_LIMIT = Math.max(
  1,
  Number.parseInt(process.env.GEMINI_DAILY_QUESTION_LIMIT ?? "20", 10) || 20,
);

export type ChatQuotaState = {
  period: string;
  used: number;
  lockUntil: string | null;
};

export type ChatQuotaView = {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
  lockedUntil: string | null;
  limited: boolean;
  label: string;
};

function dateKeyInZone(date: Date, timeZone: string): string {
  return date.toLocaleDateString("en-CA", { timeZone });
}

function addCalendarDay(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

function instantAtTimezone(dateKey: string, hour: number, minute: number, timeZone: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  let utc = Date.UTC(year, month - 1, day, hour + 8, minute, 0);

  for (let i = 0; i < 4; i += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(utc));
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    const asLocal = Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour"),
      value("minute"),
      value("second"),
    );
    const wanted = Date.UTC(year, month - 1, day, hour, minute, 0);
    utc += wanted - asLocal;
  }

  return new Date(utc);
}

export function pacificPeriodKey(now = new Date()): string {
  return dateKeyInZone(now, PACIFIC);
}

export function pacificResetAt(now = new Date()): Date {
  return instantAtTimezone(addCalendarDay(pacificPeriodKey(now)), 0, 0, PACIFIC);
}

export function formatWaitUntil(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString("pt-BR", {
    timeZone: SAO_PAULO,
    hour: "2-digit",
    minute: "2-digit",
  });
  const day = dateKeyInZone(date, SAO_PAULO);
  const today = dateKeyInZone(now, SAO_PAULO);
  if (day === today) return `hoje às ${time}`;
  if (day === addCalendarDay(today)) return `amanhã às ${time}`;
  const dated = date.toLocaleDateString("pt-BR", {
    timeZone: SAO_PAULO,
    day: "2-digit",
    month: "2-digit",
  });
  return `${dated} às ${time}`;
}

export function emptyQuotaState(now = new Date()): ChatQuotaState {
  return { period: pacificPeriodKey(now), used: 0, lockUntil: null };
}

export function parseQuotaCookie(value: string | undefined, now = new Date()): ChatQuotaState {
  const fresh = emptyQuotaState(now);
  if (!value) return fresh;
  try {
    const parsed = JSON.parse(value) as Partial<ChatQuotaState>;
    if (parsed.period !== fresh.period) return fresh;
    const used = Number(parsed.used);
    return {
      period: fresh.period,
      used: Number.isFinite(used) ? Math.max(0, Math.min(CHAT_DAILY_LIMIT, Math.floor(used))) : 0,
      lockUntil: typeof parsed.lockUntil === "string" ? parsed.lockUntil : null,
    };
  } catch {
    return fresh;
  }
}

export function serializeQuotaCookie(state: ChatQuotaState): string {
  return JSON.stringify(state);
}

export function getQuotaView(state: ChatQuotaState, now = new Date()): ChatQuotaView {
  const resetsAt = pacificResetAt(now).toISOString();
  const lockMs = state.lockUntil ? new Date(state.lockUntil).getTime() : 0;
  const lockedUntil = lockMs > now.getTime() ? new Date(lockMs).toISOString() : null;
  const remaining = Math.max(0, CHAT_DAILY_LIMIT - state.used);
  const waitUntil = lockedUntil ?? (remaining === 0 ? resetsAt : null);
  const limited = Boolean(waitUntil);
  const label = limited && waitUntil
    ? `Você atingiu o limite de perguntas. Aguarde até ${formatWaitUntil(waitUntil, now)}.`
    : `Disponíveis ${remaining} pergunta${remaining === 1 ? "" : "s"}`;

  return {
    used: state.used,
    limit: CHAT_DAILY_LIMIT,
    remaining,
    resetsAt,
    lockedUntil: waitUntil,
    limited,
    label,
  };
}

export function consumeQuestion(state: ChatQuotaState): ChatQuotaState {
  return { ...state, used: Math.min(CHAT_DAILY_LIMIT, state.used + 1) };
}

export function lockQuota(state: ChatQuotaState, retryAt: Date, now = new Date()): ChatQuotaState {
  const dailyReset = pacificResetAt(now);
  const until = retryAt.getTime() - now.getTime() > 10 * 60 * 1000 ? dailyReset : retryAt;
  const nextUsed =
    until.getTime() >= dailyReset.getTime() - 60 * 1000 ? CHAT_DAILY_LIMIT : state.used;
  return {
    ...state,
    used: nextUsed,
    lockUntil: until.toISOString(),
  };
}

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.message} ${error.stack ?? ""}`;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function isGeminiQuotaError(error: unknown): boolean {
  const status = (error as { status?: string | number })?.status;
  const code = (error as { code?: string | number })?.code;
  if (status === 429 || code === 429 || status === "RESOURCE_EXHAUSTED" || code === "RESOURCE_EXHAUSTED") {
    return true;
  }
  return /429|RESOURCE_EXHAUSTED|TooManyRequests|quota|rate.?limit/i.test(errorText(error));
}

export function geminiRetryAt(error: unknown, now = new Date()): Date {
  const text = errorText(error);
  const details = (error as { errorDetails?: unknown; details?: unknown }).errorDetails
    ?? (error as { details?: unknown }).details;
  const blob = `${text} ${typeof details === "string" ? details : JSON.stringify(details ?? "")}`;
  const secondsMatch = /retryDelay["':\s]+"?(\d+(?:\.\d+)?)s|"retryDelay":\s*"(\d+)s"|retry in (\d+(?:\.\d+)?)s/i.exec(
    blob,
  );
  const seconds = Number(secondsMatch?.[1] ?? secondsMatch?.[2] ?? secondsMatch?.[3] ?? 0);
  if (seconds > 0) return new Date(now.getTime() + seconds * 1000);

  const minutesMatch = /retry in (\d+)m/i.exec(blob);
  if (minutesMatch) return new Date(now.getTime() + Number(minutesMatch[1]) * 60 * 1000);

  return new Date(now.getTime() + 60 * 1000);
}
