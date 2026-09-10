"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface PageEntry {
  href: string;
  label: string;
  icon: string;
  keywords?: string;
}

const PAGES: PageEntry[] = [
  { href: "/dashboard", label: "Início", icon: "🏠" },
  { href: "/mes", label: "Meu mês", icon: "📊", keywords: "relatorio saude alertas" },
  { href: "/visao", label: "Dashboard / Visão geral", icon: "📈", keywords: "graficos analise" },
  { href: "/detalhes", label: "Extrato", icon: "🧾", keywords: "lancamentos transacoes" },
  { href: "/fluxo", label: "Fluxo de caixa", icon: "🔄", keywords: "previsao contas" },
  { href: "/metas", label: "Metas", icon: "🎯", keywords: "economia objetivo" },
  { href: "/chat", label: "Chat IA", icon: "💬", keywords: "assistente ia" },
  { href: "/ativos", label: "Investimentos", icon: "💹", keywords: "ativos" },
  { href: "/bancos", label: "Bancos", icon: "🏦", keywords: "conexoes pluggy sincronizar" },
];

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    function handleOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("mf:open-search", handleOpenEvent);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mf:open-search", handleOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpa a busca sempre que o painel abre
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    const term = normalize(query.trim());
    if (!term) return PAGES;
    return PAGES.filter((page) => normalize(`${page.label} ${page.keywords ?? ""}`).includes(term));
  }, [query]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function searchInExtrato() {
    if (!query.trim()) return;
    setOpen(false);
    router.push(`/detalhes?q=${encodeURIComponent(query.trim())}`);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/60 p-4 pt-24" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
          <span className="text-zinc-500">🔎</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (results[0]) go(results[0].href);
              }
            }}
            placeholder="Ir para... ou buscar no extrato"
            className="flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
          />
          <kbd className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500">esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {results.map((page) => (
            <button
              key={page.href}
              type="button"
              onClick={() => go(page.href)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-900"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-base">
                {page.icon}
              </span>
              {page.label}
            </button>
          ))}
          {query.trim() && (
            <button
              type="button"
              onClick={searchInExtrato}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-emerald-400 hover:bg-zinc-900"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-base">🧾</span>
              Buscar &quot;{query.trim()}&quot; no extrato
            </button>
          )}
          {results.length === 0 && !query.trim() && (
            <p className="px-3 py-6 text-center text-sm text-zinc-500">Digite pra buscar páginas...</p>
          )}
        </div>
      </div>
    </div>
  );
}
