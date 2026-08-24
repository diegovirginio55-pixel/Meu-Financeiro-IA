"use client";

import TabNav from "@/components/nav/TabNav";
import BottomNav from "@/components/nav/BottomNav";
import AutoBankSync from "@/components/bancos/AutoBankSync";
import { usePhoneLayout } from "@/lib/ui/use-phone-layout";

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const phone = usePhoneLayout();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {!phone && <TabNav />}
      <AutoBankSync />
      <main
        className={
          phone
            ? "mx-auto w-full max-w-lg px-4 pt-4 pb-28"
            : "mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 md:pb-6"
        }
      >
        {children}
      </main>
      {phone && <BottomNav />}
    </div>
  );
}
