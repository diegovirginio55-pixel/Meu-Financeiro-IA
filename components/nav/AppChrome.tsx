"use client";

import { usePathname } from "next/navigation";
import TabNav from "@/components/nav/TabNav";
import BottomNav from "@/components/nav/BottomNav";
import AutoBankSync from "@/components/bancos/AutoBankSync";

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/dashboard";

  return (
    <div className={isHome ? "min-h-screen bg-[#C9D6DE] text-zinc-900" : "min-h-screen bg-zinc-950 text-zinc-100"}>
      {!isHome && (
        <div className="hidden md:block">
          <TabNav />
        </div>
      )}
      <AutoBankSync />
      <main
        className={
          isHome
            ? "mx-auto min-h-screen w-full max-w-[430px] bg-[#F4F7F8] pb-24 shadow-2xl"
            : "mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 md:pb-6"
        }
      >
        {children}
      </main>
      <div className={isHome ? "block" : "md:hidden"}>
        <BottomNav />
      </div>
    </div>
  );
}
