"use client";

import { useMemo, useState } from "react";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { formatCurrency } from "@/lib/finance/format";
import { CATEGORIES, CATEGORY_ICONS } from "@/lib/finance/categories";
import { categoryUsage, type CategoryLimits } from "@/lib/finance/category-budgets";
import { isGasto, saoPauloMonthKey, shiftMonthKey } from "@/lib/finance/fluxo";
import { formatBRLInput, parseBRL } from "@/lib/ui/money";
import type { Transaction } from "@/lib/finance/types";

/** Média mensal de gastos da categoria nos 3 meses anteriores, arredondada para cima de 50 em 50. */
function suggestedLimit(historyTx: Transaction[], category: string, monthKey: string): number | null {
  const months = [1, 2, 3].map((delta) => shiftMonthKey(monthKey, -delta));
  const total = historyTx
    .filter((tx) => tx.category === category && isGasto(tx) && months.some((month) => tx.date.startsWith(month)))
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  if (total <= 0) return null;
  return Math.ceil(total / 3 / 50) * 50;
}

function barColor(pct: number) {
  if (pct >= 1) return "bg-rose-500";
  if (pct >= 0.8) return "bg-amber-400";
  return "bg-emerald-400";
}

/**
 * Limite mensal por categoria ("Alimentação: R$ 800"): mostra quanto já foi
 * gasto e avisa por notificação em 80% e ao estourar.
 */
export function CategoryBudgetsCard({ initialLimits, historyTx }: { initialLimits: CategoryLimits; historyTx: Transaction[] }) {
  const [limits, setLimits] = useState<CategoryLimits>(initialLimits);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [newCategory, setNewCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const monthKey = useMemo(() => saoPauloMonthKey(), []);

  const monthTx = useMemo(() => historyTx.filter((tx) => tx.date.startsWith(monthKey)), [historyTx, monthKey]);
  const usage = useMemo(() => categoryUsage(limits, monthTx), [limits, monthTx]);
  const available = CATEGORIES.filter((category) => !(category in draft) && category !== "Salário");

  function startEdit() {
    setDraft(Object.fromEntries(Object.entries(limits).map(([category, limit]) => [category, formatBRLInput(limit)])));
    setNewCategory("");
    setError(null);
    setEditing(true);
  }

  function addCategory(category: string) {
    if (!category) return;
    const suggestion = suggestedLimit(historyTx, category, monthKey);
    setDraft((current) => ({ ...current, [category]: suggestion ? formatBRLInput(suggestion) : "" }));
    setNewCategory("");
  }

  async function save() {
    const next: CategoryLimits = {};
    for (const [category, text] of Object.entries(draft)) {
      if (!text.trim()) continue;
      const value = parseBRL(text);
      if (value === null || value <= 0) {
        setError(`Valor inválido em ${category}.`);
        return;
      }
      next[category] = value;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/budget/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limits: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { limits?: CategoryLimits; error?: string };
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar.");
      setLimits(data.limits ?? next);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4 lg:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">Limite por categoria</h2>
        {!editing && (
          <button type="button" onClick={startEdit} className="text-xs text-emerald-400 hover:underline">
            {usage.length ? "editar" : "definir"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2.5">
          {Object.keys(draft).length === 0 && (
            <p className="text-sm text-zinc-500">Escolha uma categoria abaixo. O app sugere um limite pela sua média dos últimos 3 meses.</p>
          )}
          {Object.entries(draft).map(([category, value]) => (
            <div key={category} className="flex items-center gap-2">
              <span className="w-32 shrink-0 truncate text-sm text-zinc-300">
                {CATEGORY_ICONS[category] ?? "🔖"} {category}
              </span>
              <MoneyInput
                value={value}
                onValueChange={(next) => setDraft((current) => ({ ...current, [category]: next }))}
                compact
                className="min-w-0 flex-1"
                aria-label={`Limite de ${category}`}
              />
              <button
                type="button"
                onClick={() =>
                  setDraft((current) => {
                    const copy = { ...current };
                    delete copy[category];
                    return copy;
                  })
                }
                aria-label={`Tirar ${category}`}
                className="shrink-0 px-1 text-zinc-500 hover:text-rose-400"
              >
                ✕
              </button>
            </div>
          ))}
          {available.length > 0 && (
            <select
              value={newCategory}
              onChange={(event) => addCategory(event.target.value)}
              aria-label="Adicionar categoria"
              className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950 px-3 py-2 text-base text-zinc-300"
            >
              <option value="">+ Adicionar categoria…</option>
              {available.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          )}
          {error && (
            <p role="alert" className="text-sm text-rose-400">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-full px-3 py-1.5 text-sm text-zinc-400">
              Cancelar
            </button>
          </div>
        </div>
      ) : usage.length === 0 ? (
        <p className="text-sm leading-relaxed text-zinc-500">
          Defina um limite por mês para as categorias que mais pesam (mercado, iFood, lazer…). Você recebe um aviso ao chegar
          em 80% e se passar do limite.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {usage.map((item) => (
            <li key={item.category}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-zinc-200">
                  {CATEGORY_ICONS[item.category] ?? "🔖"} {item.category}
                </span>
                <span className={item.pct >= 1 ? "text-rose-300" : "text-zinc-400"}>
                  {formatCurrency(item.spent)} <span className="text-zinc-600">/ {formatCurrency(item.limit)}</span>
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-800">
                <div className={`h-full rounded-full ${barColor(item.pct)}`} style={{ width: `${Math.min(100, item.pct * 100)}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                {item.pct >= 1
                  ? `Passou ${formatCurrency(item.spent - item.limit)} do limite`
                  : `Restam ${formatCurrency(item.limit - item.spent)} · ${Math.round(item.pct * 100)}% usado`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
