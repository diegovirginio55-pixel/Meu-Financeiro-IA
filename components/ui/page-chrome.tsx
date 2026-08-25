"use client";

import { useEffect, useState } from "react";

export function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="-mx-4 pb-6 text-zinc-100 lg:-mx-6 xl:-mx-10 2xl:-mx-14 lg:pb-8">{children}</div>;
}

export function PageHero({
  kicker,
  title,
  subtitle,
  trailing,
  children,
}: {
  kicker: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden px-4 pb-6 pt-1 lg:px-6 lg:pb-10 xl:px-10 2xl:px-14">
      <div className="pointer-events-none absolute -right-16 -top-10 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl lg:h-80 lg:w-80" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl" />
      <header className="relative flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-emerald-400/90">{kicker}</p>
        {trailing}
      </header>
      <div className="relative mt-8 lg:mt-10">
        {typeof title === "string" ? (
          <h1 className="text-[34px] font-semibold leading-[1.05] tracking-tight text-white lg:text-5xl">
            {title}
          </h1>
        ) : (
          title
        )}
      </div>
      {subtitle ? <div className="relative mt-2 text-xs text-zinc-500 lg:text-sm">{subtitle}</div> : null}
      {children ? <div className="relative mt-6 max-w-xl lg:mt-8 lg:max-w-3xl">{children}</div> : null}
    </section>
  );
}

export function HeroAmount({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[44px] font-semibold leading-none tracking-tight text-white lg:text-[64px]">
      {children}
    </p>
  );
}

export function SectionLabel({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">{children}</h2>
      {action}
    </div>
  );
}

export function SoftPanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70 lg:rounded-3xl ${className}`}>
      {children}
    </div>
  );
}

export function chipClass(active: boolean) {
  return `shrink-0 rounded-full px-3 py-1.5 text-sm ${
    active ? "bg-white text-zinc-950" : "border border-zinc-800 bg-zinc-900 text-zinc-300"
  }`;
}

export type BalanceView = "total" | "conta";

const BALANCE_VIEW_KEY = "mf-balance-view";
const BALANCE_VIEW_EVENT = "mf-balance-view";

function readBalanceView(): BalanceView {
  if (typeof window === "undefined") return "total";
  const stored = window.localStorage.getItem(BALANCE_VIEW_KEY);
  return stored === "conta" || stored === "total" ? stored : "total";
}

export function useBalanceView() {
  const [value, setValue] = useState<BalanceView>("total");

  useEffect(() => {
    setValue(readBalanceView());
    function sync() {
      setValue(readBalanceView());
    }
    window.addEventListener("storage", sync);
    window.addEventListener(BALANCE_VIEW_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(BALANCE_VIEW_EVENT, sync);
    };
  }, []);

  function onChange(next: BalanceView) {
    setValue(next);
    window.localStorage.setItem(BALANCE_VIEW_KEY, next);
    window.dispatchEvent(new Event(BALANCE_VIEW_EVENT));
  }

  return [value, onChange] as const;
}

export function BalanceViewToggle({
  value,
  onChange,
}: {
  value: BalanceView;
  onChange: (value: BalanceView) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tipo de saldo">
        <button
          type="button"
          role="tab"
          aria-selected={value === "total"}
          onClick={() => onChange("total")}
          className={chipClass(value === "total")}
        >
          Saldo total
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={value === "conta"}
          onClick={() => onChange("conta")}
          className={chipClass(value === "conta")}
        >
          Saldo em conta
        </button>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        {value === "total" ? "contas + investimentos" : "somente o livre nas contas"}
      </p>
    </div>
  );
}
