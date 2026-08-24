import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppChrome from "@/components/nav/AppChrome";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/login");
  }

  return <AppChrome>{children}</AppChrome>;
}
