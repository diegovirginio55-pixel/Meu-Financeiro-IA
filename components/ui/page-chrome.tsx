export function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="-mx-4 pb-6 text-zinc-100 lg:-mx-6 lg:pb-8">{children}</div>;
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
    <section className="relative overflow-hidden px-4 pb-6 pt-1 lg:px-6 lg:pb-10">
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
      {children ? <div className="relative mt-6 max-w-xl lg:mt-8 lg:max-w-2xl">{children}</div> : null}
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
