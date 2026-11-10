"use client";

import TabNav from "@/components/nav/TabNav";
import BottomNav from "@/components/nav/BottomNav";
import AutoBankSync from "@/components/bancos/AutoBankSync";
import LiveRefresh from "@/components/nav/LiveRefresh";
import PrefetchTabs from "@/components/nav/PrefetchTabs";
import SaveLastPath from "@/components/nav/SaveLastPath";
import { PushEnable } from "@/components/pwa/PushEnable";
import { LockGate } from "@/components/pwa/AppLock";
import IntroSplash from "@/components/brand/IntroSplash";
import { PhoneLayoutContext, usePhoneLayout } from "@/lib/ui/use-phone-layout";
import { HideValuesContext } from "@/lib/ui/hide-values";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { CommandPalette } from "@/components/search/CommandPalette";
import { NotificationsProvider } from "@/components/notifications/NotificationBell";

export default function AppChrome({
  children,
  initialPhone = false,
  initialHideValues = false,
  lockEnabled = false,
}: {
  children: React.ReactNode;
  /** Calculado no servidor pelo user-agent — o SSR já sai com o layout certo. */
  initialPhone?: boolean;
  /** Cookie "ocultar valores" lido no servidor — o SSR já sai mascarado. */
  initialHideValues?: boolean;
  /** Cookie do bloqueio com digital: o app só monta depois do desbloqueio. */
  lockEnabled?: boolean;
}) {
  return (
    <PhoneLayoutContext value={initialPhone}>
      <HideValuesContext value={initialHideValues}>
        <LockGate enabled={lockEnabled}>
          <NotificationsProvider>
            <ChromeLayout>{children}</ChromeLayout>
          </NotificationsProvider>
        </LockGate>
      </HideValuesContext>
    </PhoneLayoutContext>
  );
}

function ChromeLayout({ children }: { children: React.ReactNode }) {
  const phone = usePhoneLayout();

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100">
      <IntroSplash />
      {!phone && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.12),_transparent_60%)]" />
          <TabNav />
        </>
      )}
      <SaveLastPath />
      <PrefetchTabs />
      <AutoBankSync />
      <LiveRefresh />
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
      <CommandPalette />
      <OnboardingModal />
    </div>
  );
}
