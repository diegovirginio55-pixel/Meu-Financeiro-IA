import { cookies } from "next/headers";
import {
  CHAT_QUOTA_COOKIE,
  parseQuotaCookie,
  serializeQuotaCookie,
  type ChatQuotaState,
} from "./quota";

export async function readChatQuota(): Promise<ChatQuotaState> {
  const jar = await cookies();
  return parseQuotaCookie(jar.get(CHAT_QUOTA_COOKIE)?.value);
}

export async function writeChatQuota(state: ChatQuotaState): Promise<void> {
  const jar = await cookies();
  jar.set(CHAT_QUOTA_COOKIE, serializeQuotaCookie(state), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 48,
  });
}
