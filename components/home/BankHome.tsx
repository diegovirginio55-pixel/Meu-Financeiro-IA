"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/finance/format";
import type { BankConnectionWithAssets } from "@/lib/finance/bank-connections";
import type { Account } from "@/lib/finance/types";
import type { FinancialSnapshot } from "@/lib/finance/summary";
import { getBankBrand, officialInstitutionName } from "@/lib/pluggy/brands";
import { BankLogo } from "@/components/bancos/BankLogo";

const CAIXA_BLUE = "#005CA9";
const SERVICE_ICON = "#7A8B96";

function accountKind(account: Account): string {
  const haystack = `${account.name} ${account.type}`.toLowerCase();
  if (haystack.includes("poup") || account.type === "poupanca") return "Poupança";
  if (haystack.includes("corrente")) return "Conta corrente";
  if (haystack.includes("salário") || haystack.includes("salario")) return "Conta salário";
  if (haystack.includes("cartão") || haystack.includes("cartao") || account.type === "credito") {
    return "Cartão";
  }
  return "Conta";
}

function accountSubtitle(account: Account): string {
  const kind = accountKind(account);
  const digits = account.name.replace(/\D/g, "");
  if (digits.length >= 4) return `${kind} •••• ${digits.slice(-4)}`;
  const cleaned = account.name.replace(/^.*[·•]\s*/, "").trim();
  return cleaned || kind;
}

function shortBankName(name: string) {
  if (name === "Caixa Econômica Federal") return "Caixa";
  return name;
}

function isCaixa(name: string) {
  return name.toLowerCase().includes("caixa");
}

export default function BankHome({
  snapshot,
  connections,
}: {
  snapshot: FinancialSnapshot;
  connections: BankConnectionWithAssets[];
}) {
  const [connectionId, setConnectionId] = useState(connections[0]?.id ?? "all");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [hidden, setHidden] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  const selected = useMemo(() => {
    if (connectionId === "all") return connections[0] ?? null;
    return connections.find((connection) => connection.id === connectionId) ?? connections[0] ?? null;
  }, [connectionId, connections]);

  const accounts = selected?.accounts ?? snapshot.accounts;
  const currentAccount =
    accounts.find((account) => account.id === accountId) ?? accounts[0] ?? null;

  const bankName = officialInstitutionName(selected?.institution_name ?? "Meu Financeiro");
  const brand = getBankBrand(bankName);
  const header = isCaixa(bankName) ? CAIXA_BLUE : (brand?.bg ?? CAIXA_BLUE);
  const balance = currentAccount ? Number(currentAccount.balance) : snapshot.totalBalance;
  const title = shortBankName(bankName);

  if (connections.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F4F7F8] px-6 text-center text-[#314049]">
        <p className="text-lg font-semibold">Nenhum banco conectado</p>
        <p className="mt-2 text-sm text-zinc-500">Conecte Caixa, Inter ou Nubank para ver o saldo aqui.</p>
        <Link href="/bancos" className="mt-5 rounded-full bg-[#005CA9] px-5 py-2.5 text-sm font-medium text-white">
          Conectar banco
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7F8] pb-8 text-[#314049]">
      <header
        className="px-5 pb-[72px] pt-[max(1rem,env(safe-area-inset-top))] text-white"
        style={{ background: header }}
      >
        <div className="flex items-start justify-between">
          <button type="button" onClick={() => setPickerOpen((open) => !open)} className="flex items-center gap-2.5 text-left">
            {isCaixa(bankName) ? (
              <CaixaMark />
            ) : (
              <BankLogo name={bankName} imageUrl={selected?.institution_image_url} size="lg" />
            )}
            <span>
              <span className="block text-[22px] font-bold leading-none tracking-tight">{title}</span>
              <span className="mt-1 flex items-center gap-1 text-[12px] font-medium text-white/90">
                {currentAccount ? accountSubtitle(currentAccount) : "Toque para escolher a conta"}
                <ChevronDown />
              </span>
            </span>
          </button>
          <div className="flex items-center gap-4 pt-0.5 text-white">
            <button type="button" onClick={() => setHidden((value) => !value)} aria-label={hidden ? "Mostrar saldo" : "Ocultar saldo"}>
              {hidden ? <EyeOffIcon /> : <EyeIcon />}
            </button>
            <Link href="/bancos" aria-label="Notificações" className="relative">
              <BellIcon />
              <span className="absolute right-0.5 top-0 h-2 w-2 rounded-full bg-[#E53935]" />
            </Link>
          </div>
        </div>
      </header>

      {pickerOpen && (
        <div className="relative z-20 mx-4 -mt-14 rounded-2xl bg-white p-3 shadow-lg">
          {connections.map((connection) => (
            <button
              key={connection.id}
              type="button"
              onClick={() => {
                setConnectionId(connection.id);
                setAccountId(connection.accounts[0]?.id ?? null);
                setPickerOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-zinc-100"
            >
              <BankLogo name={officialInstitutionName(connection.institution_name)} imageUrl={connection.institution_image_url} size="sm" />
              <span className="text-sm font-medium text-zinc-800">
                {officialInstitutionName(connection.institution_name)}
              </span>
            </button>
          ))}
          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              onClick={() => {
                setAccountId(account.id);
                setPickerOpen(false);
              }}
              className="flex w-full flex-col rounded-xl px-2 py-2 text-left text-sm hover:bg-zinc-100"
            >
              <span className="font-medium text-zinc-800">{accountKind(account)}</span>
              <span className="text-xs text-zinc-500">{accountSubtitle(account)}</span>
            </button>
          ))}
        </div>
      )}

      <section className="relative z-10 mx-4 -mt-[52px] rounded-[18px] bg-white px-5 py-4 shadow-[0_10px_28px_rgba(16,60,90,0.12)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] text-[#8A97A0]">Saldo {currentAccount ? accountKind(currentAccount).toLowerCase() : "total"}</p>
            <p className="mt-1 text-[30px] font-semibold leading-none tracking-wide text-[#1A1A1A]">
              {hidden ? (
                <span className="inline-flex items-baseline gap-1.5">
                  <span className="text-[18px] font-medium text-[#8A97A0]">R$</span>
                  <span className="tracking-[0.22em]">•••••</span>
                </span>
              ) : (
                formatCurrency(balance)
              )}
            </p>
          </div>
          <Link
            href="/detalhes"
            className="flex h-11 w-11 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: header }}
            aria-label="Ver extrato"
          >
            <ArrowRight />
          </Link>
        </div>
        <Link href="/bancos" className="mt-4 flex items-center gap-3 border-t border-[#EEF1F3] pt-3">
          <OpenFinanceIcon />
          <span className="flex-1 text-[13px] font-medium leading-snug text-[#005CA9]">
            Conectar outro banco
          </span>
          <span className="text-lg text-[#005CA9]">›</span>
        </Link>
      </section>

      <section className="mx-4 mt-3.5 grid grid-cols-3 gap-2.5">
        <QuickAction href="/detalhes" label="Extrato">
          <BarcodeIcon color={header} />
        </QuickAction>
        <QuickAction href="/fluxo" label="Fluxo">
          <LoanIcon color={header} />
        </QuickAction>
        <QuickAction href="/chat" label="Chat IA">
          <ChatQuickIcon color={header} />
        </QuickAction>
      </section>

      <section className="mx-4 mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[18px] font-bold text-[#2C3A42]">Atalhos</h2>
          <Link href="/visao" className="text-[13px] font-medium text-[#005CA9]">
            Ver gráficos &gt;
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { href: "/bancos", label: "Bancos", icon: "logo" },
            { href: "/ativos", label: "Investimentos", icon: "chart" },
            { href: "/visao", label: "Gráficos", icon: "home" },
            { href: "/detalhes", label: "Extrato", icon: "doc" },
            { href: "/fluxo", label: "Fluxo", icon: "card" },
            { href: "/chat", label: "Chat IA", icon: "leaf" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-[16px] bg-white px-2 text-center shadow-[0_1px_4px_rgba(16,40,60,0.06)]"
            >
              {item.icon === "logo" ? (
                isCaixa(bankName) ? (
                  <CaixaMark muted />
                ) : (
                  <BankLogo name={bankName} imageUrl={selected?.institution_image_url} size="sm" />
                )
              ) : (
                <ServiceGlyph name={item.icon} />
              )}
              <span className="text-[12px] font-medium leading-tight text-[#4A5A64]">{item.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-4 mt-6">
        <h2 className="mb-3 text-[18px] font-bold text-[#2C3A42]">Destaques</h2>
        <div className="grid grid-cols-2 gap-2.5">
          <Link href="/chat" className="flex min-h-[148px] flex-col justify-between rounded-[16px] p-4 text-white" style={{ backgroundColor: header }}>
            <HeartHandIcon />
            <p className="text-[14px] font-semibold leading-snug">Conversar com a IA sobre seus gastos</p>
          </Link>
          <Link href="/ativos" className="flex min-h-[148px] flex-col justify-between rounded-[16px] p-4 text-white" style={{ backgroundColor: header }}>
            <PhoneCheckIcon />
            <p className="text-[14px] font-semibold leading-snug">Ver investimentos e lucro diário</p>
          </Link>
        </div>
      </section>
    </div>
  );
}

function QuickAction({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-[16px] bg-white px-2 text-center shadow-[0_1px_4px_rgba(16,40,60,0.06)]"
    >
      {children}
      <span className="text-[12px] font-medium leading-tight text-[#3B6A8C]">{label}</span>
    </Link>
  );
}

function CaixaMark({ muted = false }: { muted?: boolean }) {
  const top = muted ? SERVICE_ICON : "#F39200";
  const bottom = muted ? SERVICE_ICON : "#F7D117";
  return (
    <svg viewBox="0 0 48 48" className="h-9 w-9 shrink-0" aria-hidden>
      <path fill={top} d="M24 11 36.5 23.2 32.7 27 24 18.5 15.3 27 11.5 23.2 24 11Z" />
      <path fill={bottom} d="M24 37 11.5 24.8 15.3 21 24 29.5 32.7 21 36.5 24.8 24 37Z" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden>
      <path d="M2 4.2 6 8l4-3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path d="M8 5.5 15.5 12 8 18.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
      <path d="M3 3l18 18M10.5 10.7A3 3 0 0 0 13.3 13.5M9.9 5.5A11 11 0 0 1 12 5.2c5 0 9.3 3.5 10.8 8.3a11.7 11.7 0 0 1-4.2 5.5M6.1 6.5A11.6 11.6 0 0 0 1.2 13.5 11.6 11.6 0 0 0 12 18.8c1.3 0 2.5-.2 3.6-.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
      <path d="M1.2 12.5C2.7 7.7 7 4.2 12 4.2s9.3 3.5 10.8 8.3C21.3 17.3 17 20.8 12 20.8S2.7 17.3 1.2 12.5Z" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
      <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M10 18.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function OpenFinanceIcon() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
      <circle cx="16" cy="16" r="15" fill="#F4F7F8" />
      <path d="M16 7.2a8.8 8.8 0 0 1 7.4 4.1" fill="none" stroke="#00A9E0" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M23.4 11.3 21.2 8.4M23.4 11.3l2.6-1.2" fill="none" stroke="#00A9E0" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M23.5 20.2A8.8 8.8 0 0 1 9.8 23.2" fill="none" stroke="#7AC143" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M9.8 23.2 11.2 20.4M9.8 23.2 7.4 24.6" fill="none" stroke="#7AC143" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M9.2 11.8A8.8 8.8 0 0 1 16 7.2" fill="none" stroke="#F39200" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M9.2 11.8 11.8 13M9.2 11.8 8.4 9" fill="none" stroke="#F39200" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function LoanIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 48 48" className="h-9 w-9" fill="none" aria-hidden>
      <path d="M10 28c4.5-1 8-4 10.5-8.5 1.2 3.5 3.8 6.2 8.5 7.2" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M8 31.5c6 0 8.5-3 11-7.5 1.8 4 5.2 7 11.5 7" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="32.5" cy="18" r="7" stroke={color} strokeWidth="2" />
      <path d="M32.5 14.2v7.6M30 16.2h3.4c1.2 0 2 .6 2 1.6s-.8 1.6-2 1.6H30" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M29 28.5 34 36h6.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BarcodeIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 48 48" className="h-9 w-9" fill="none" aria-hidden>
      <path d="M10 12v24M14.5 12v24M18 12v24M20.5 12v24M25 12v24M28.5 12v24M32 12v24M38 12v24" stroke={color} strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
}

function ChatQuickIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" aria-hidden>
      <path
        d="M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 19 16.5H11l-4 3v-3H5A1.5 1.5 0 0 1 3.5 15V8A1.5 1.5 0 0 1 5 6.5Z"
        stroke={color}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeartHandIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-9 w-9" fill="none" aria-hidden>
      <path d="M24 16.5c-1.6-3.8-7-3.6-7.8.6-.6 3 2.2 5.4 7.8 9.4 5.6-4 8.4-6.4 7.8-9.4-.8-4.2-6.2-4.4-7.8-.6Z" fill="currentColor" />
      <path d="M10 28c5-1 8.5-4.2 11-8.8 1.6 3.8 5 6.6 11.2 7.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 29.5 33.5 37h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PhoneCheckIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-9 w-9" fill="none" aria-hidden>
      <rect x="14" y="6" width="16" height="28" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M20 30h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="32" r="8" fill="#ffffff22" stroke="currentColor" strokeWidth="2" />
      <path d="M28.8 32.2 31.2 34.6 36 29.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ServiceGlyph({ name }: { name: string }) {
  const common = { stroke: SERVICE_ICON, strokeWidth: 1.7, fill: "none" as const };
  if (name === "chart") {
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
        <path d="M5 18V10M10 18V7M15 18v-5M20 18V5" {...common} strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "home") {
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
        <path d="M4 11 12 4l8 7v9H4v-9Z" {...common} strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "card") {
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
        <rect x="3" y="6" width="18" height="12" rx="2" {...common} />
        <path d="M3 10h18" {...common} />
        <circle cx="16.5" cy="14.5" r="1.2" fill={SERVICE_ICON} />
      </svg>
    );
  }
  if (name === "doc") {
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
        <path d="M7 3.5h7l5 5V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" {...common} />
        <path d="M10 14h4M12 12v4" {...common} strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
      <path d="M12 4 14 9l5 .4-3.8 3.3L16.5 18 12 15.2 7.5 18l1.3-5.3L5 9.4 10 9 12 4Z" {...common} />
    </svg>
  );
}
