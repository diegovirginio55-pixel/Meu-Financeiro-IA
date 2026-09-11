"use client";

import { useMemo, useState } from "react";
import { computeBudgetProgress, type MonthlyBudget } from "@/lib/finance/budget";
import { formatCurrency } from "@/lib/finance/format";
import type { Transaction } from "@/lib/finance/types";
import { SectionLabel, SoftPanel } from "@/components/ui/page-chrome";

const STATUS_BAR: Record<string, string> = {
  dentro: "bg-emerald-500",
  atencao: "bg-amber-500",
  excedido: "bg-rose-500",
  sem_meta: "bg-zinc-700",
};

function toInputValue(value: number | null): string {
  return value == null ? "" : String(value);
}

export function MonthlyBudgetCard({
  historyTx,
  initialBudget,
}: {
  historyTx: Transaction[];
  initialBudget: MonthlyBudget | null;
}) {
  const [budget, setBudget] = useState<MonthlyBudget | null>(initialBudget);
  const [editing, setEditing] = useState(initialBudget == null);
  const [spendingLimit, setSpendingLimit] = useState(toInputValue(initialBudget?.spendingLimit ?? null));
  const [savingsTarget, setSavingsTarget] = useState(toInputValue(initialBudget?.savingsTarget ?? null));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const progress = useMemo(
    () => computeBudgetProgress({ transactions: historyTx, budget }),
    [historyTx, budget],
  );

  function startEdit() {
    setSpendingLimit(toInputValue(budget?.spendingLimit ?? null));
    setSavingsTarget(toInputValue(budget?.savingsTarget ?? null));
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    setError(null);
    const limitNum = spendingLimit.trim() ? Number(spendingLimit.replace(",", ".")) : null;
    const targetNum = savingsTarget.trim() ? Number(savingsTarget.replace(",", ".")) : null;
    if (limitNum != null && (!Number.isFinite(limitNum) || limitNum < 0)) {
      setError("Informe um valor de gasto válido.");
      return;
    }
    if (targetNum != null && (!Number.isFinite(targetNum) || targetNum < 0)) {
      setError("Informe um valor de economia válido.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/budget", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spending_limit: limitNum, savings_target: targetNum }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar o orçamento.");
      setBudget({
        monthKey: data.budget.month_key,
        spendingLimit: data.budget.spending_limit,
        savingsTarget: data.budget.savings_target,
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o orçamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SoftPanel className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel>Orçamento do mês</SectionLabel>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            {budget ? "editar" : "+ definir"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-zinc-500">
            Diga quanto está disposto a gastar e a economizar este mês — o sistema acompanha e te avisa se o ritmo
            sair do combinado.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500">Quanto pretende gastar</span>
              <input
                value={spendingLimit}
                onChange={(e) => setSpendingLimit(e.target.value)}
                inputMode="decimal"
                placeholder="Ex: 3000"
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500">Quanto pretende economizar</span>
              <input
                value={savingsTarget}
                onChange={(e) => setSavingsTarget(e.target.value)}
                inputMode="decimal"
                placeholder="Ex: 500"
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
              />
            </label>
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-zinc-950 disabled:opacity-50"
            >
              {saving ? "Salvando…" : "Salvar"}
            </button>
            {budget && (
              <button type="button" onClick={() => setEditing(false)} className="text-xs text-zinc-400">
                Cancelar
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {progress.spendingLimit != null && (
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-300">Gastos do mês</span>
                <span className="text-zinc-300">
                  {formatCurrency(progress.spentThisMonth)} / {formatCurrency(progress.spendingLimit)}
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full rounded-full ${STATUS_BAR[progress.spendStatus]}`}
                  style={{ width: `${Math.min(100, Math.round((progress.spentThisMonth / progress.spendingLimit) * 100))}%` }}
                />
              </div>
            </div>
          )}

          {progress.savingsTarget != null && (
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-300">Economia do mês</span>
                <span className="text-zinc-300">
                  {formatCurrency(Math.max(0, progress.savingsThisMonth))} / {formatCurrency(progress.savingsTarget)}
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full rounded-full ${STATUS_BAR[progress.savingsStatus]}`}
                  style={{ width: `${progress.savingsProgressPct ?? 0}%` }}
                />
              </div>
            </div>
          )}

          <ul className="flex flex-col gap-1.5">
            {progress.tips.map((tip, index) => (
              <li key={index} className="text-xs text-zinc-400">
                💡 {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </SoftPanel>
  );
}
