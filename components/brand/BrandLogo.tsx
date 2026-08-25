import Link from "next/link";

const SIZE = {
  nav: {
    img: "h-9 w-9 rounded-[0.85rem]",
    kicker: "text-[10px] tracking-[0.22em]",
    title: "text-sm",
    gap: "gap-2.5",
    px: 36,
  },
  menu: {
    img: "h-10 w-10 rounded-2xl",
    kicker: "text-[10px] tracking-[0.22em]",
    title: "text-sm",
    gap: "gap-3",
    px: 40,
  },
  login: {
    img: "h-16 w-16 rounded-[1.35rem] shadow-[0_0_36px_rgba(16,185,129,0.4)]",
    kicker: "text-[11px] tracking-[0.24em]",
    title: "text-xl",
    gap: "gap-4",
    px: 64,
  },
} as const;

export function BrandLogo({
  href,
  size = "nav",
  onClick,
}: {
  href?: string;
  size?: keyof typeof SIZE;
  onClick?: () => void;
}) {
  const s = SIZE[size];
  const mark = (
    <>
      <img
        src="/logo.png?v=2"
        alt=""
        width={s.px}
        height={s.px}
        className={`${s.img} object-cover ring-1 ring-emerald-400/25`}
      />
      <span className="min-w-0 leading-tight">
        <span className={`block font-medium uppercase text-emerald-400/90 ${s.kicker}`}>Meu Financeiro</span>
        <span className={`block font-semibold tracking-tight text-white ${s.title}`}>IA</span>
      </span>
    </>
  );

  const className = `inline-flex items-center ${s.gap}`;

  if (!href) {
    return <div className={className}>{mark}</div>;
  }

  return (
    <Link href={href} prefetch aria-label="Meu Financeiro IA" onClick={onClick} className={`${className} shrink-0`}>
      {mark}
    </Link>
  );
}
