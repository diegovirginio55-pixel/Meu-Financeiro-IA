import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { lastPathFromCookie } from "@/lib/ui/nav-memory";

export default async function RootPage() {
  const jar = await cookies();
  redirect(lastPathFromCookie(jar.get("mf-last-path")?.value));
}
