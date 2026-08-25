"use client";

import TabNav from "@/components/nav/TabNav";
import BottomNav from "@/components/nav/BottomNav";
import AutoBankSync from "@/components/bancos/AutoBankSync";
import PrefetchTabs from "@/components/nav/PrefetchTabs";
import SaveLastPath from "@/components/nav/SaveLastPath";
import { PushEnable } from "@/components/pwa/PushEnable";
import { usePhoneLayout } from "@/lib/ui/use-phone-layout";

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const phone = usePhoneLayout();

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100">
      {!phone && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.12),_transparent_60%)]" />
          <TabNav />
        </>
      )}
      <SaveLastPath />
      <PrefetchTabs />
      <AutoBankSync />
      <PushEnable />
      <main
        className={
          phone
            ? "relative mx-auto w-full max-w-lg px-4 pt-4 pb-28"
            : "relative w-full flex-1 px-6 py-6 pb-10 xl:px-10 2xl:px-14"
        }
      >
        {children}
      </main>
      {phone && <BottomNav />}
    </div>
  );
}
