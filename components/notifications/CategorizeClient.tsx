"use client";

import Link from "next/link";
import { useState } from "react";
import { PageShell, SectionLabel, SoftPanel } from "@/components/ui/page-chrome";
import { CATEGORIES, CATEGORY_ICONS } from "@/lib/finance/categories";
import { formatCurrency, formatDate } from "@/lib/finance/format";

type Tx = {
  id: string;
  description: string;
  amount: number;
  type: string;
  category: string;
  date: string;
};

/**
 * Tela aberta ao tocar na notificação de um gasto novo: escolher a
 * categoria com um toque (os botões da própria notificação só cabem 2).
 */
export default function CategorizeClient({ transaction }: { transaction: Tx }) {
  const [category, setCategory] = useState(transaction.category);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedCategory, setSavedCategory] = useState<string | null>(null);
  const [alwaysUse, setAlwaysUse] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(next: string) {
    setError(null);
    setSaving(next);
    try {
      const res = await fetch(`/api/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Não foi possível salvar a categoria.");
      }
      if (alwaysUse) {
        // Regra: próximos lançamentos com a mesma descrição já chegam nessa categoria.
        await fetch("/api/category-rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pattern: transaction.description, category: next }),
        }).catch(() => undefined);
      }
      setCategory(next);
      setSavedCategory(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a categoria.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pt-2 lg:px-6">
        <SectionLabel>Categorizar gasto</SectionLabel>

        <SoftPanel className="p-4">
          <p className="text-sm text-zinc-400">{formatDate(transaction.date)}</p>
          <p className="mt-1 break-words text-base font-medium text-zinc-100">{transaction.description}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-rose-300">{formatCurrency(Number(transaction.amount))}</p>
          <p className="mt-2 text-sm text-zinc-400">
            Categoria atual:{" "}
            <span className="font-medium text-zinc-200">
              {CATEGORY_ICONS[category] ?? "🔖"} {category}
            </span>
          </p>
        </SoftPanel>

        {savedCategory ? (
          <SoftPanel className="flex flex-col gap-3 p-4">
            <p role="status" className="text-sm text-emerald-300">
              Pronto! Categorizado como {CATEGORY_ICONS[savedCategory] ?? ""} {savedCategory}.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/detalhes"
                className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
              >
                Ver extrato
              </Link>
              <button
                type="button"
                onClick={() => setSavedCategory(null)}
                className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                Escolher outra
              </button>
            </div>
          </SoftPanel>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CATEGORIES.map((option) => {
                const active = option === category;
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={saving != null}
                    onClick={() => choose(option)}
                    aria-pressed={active}
                    className={`flex min-h-12 items-center gap-2 rounded-2xl border px-3 py-3 text-left text-sm transition disabled:opacity-60 ${
                      active
                        ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                        : "border-zinc-800 bg-zinc-900/60 text-zinc-200 hover:border-zinc-600"
                    }`}
                  >
                    <span aria-hidden className="text-lg">
                      {CATEGORY_ICONS[option] ?? "🔖"}
                    </span>
                    <span className="min-w-0 truncate">{saving === option ? "Salvando…" : option}</span>
                  </button>
                );
              })}
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={alwaysUse}
                onChange={(event) => setAlwaysUse(event.target.checked)}
                className="mt-0.5 h-5 w-5 accent-emerald-500"
              />
              <span>
                Usar sempre esta categoria para lançamentos com “{transaction.description}”
              </span>
            </label>
          </>
        )}

        {error && (
          <p role="alert" className="text-sm text-rose-400">
            {error}
          </p>
        )}
      </div>
    </PageShell>
  );
}
