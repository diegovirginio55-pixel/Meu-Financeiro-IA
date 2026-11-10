"use client";

import { useMemo, useState } from "react";
import { computeBudgetProgress, type MonthlyBudget } from "@/lib/finance/budget";
import { formatCurrency } from "@/lib/finance/format";
import type { Transaction } from "@/lib/finance/types";
import { SectionLabel, SoftPanel } from "@/components/ui/page-chrome";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { formatBRLInput, parseBRL } from "@/lib/ui/money";
import { BudgetJar } from "@/components/metas/BudgetJar";

const STATUS_BAR: Record<string, string> = {
  dentro: "bg-emerald-500",
  atencao: "bg-amber-500",
  excedido: "bg-rose-500",
  sem_meta: "bg-zinc-700",
};

function toInputValue(value: number | null): string {
  return formatBRLInput(value);
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
    // Vazio = sem meta para esse item; preenchido precisa ser um valor válido (ex.: 3.000,00).
    const limitNum = spendingLimit.trim() ? parseBRL(spendingLimit) : null;
    const targetNum = savingsTarget.trim() ? parseBRL(savingsTarget) : null;
    if (spendingLimit.trim() && (limitNum == null || limitNum < 0)) {
      setError("Informe um valor de gasto válido.");
      return;
    }
    if (savingsTarget.trim() && (targetNum == null || targetNum < 0)) {
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
              <span className="text-xs text-zinc-400">Quanto pretende gastar</span>
              <MoneyInput
                value={spendingLimit}
                onValueChange={setSpendingLimit}
                placeholder="Ex: 3.000,00"
                invalid={error != null && spendingLimit.trim() !== "" && parseBRL(spendingLimit) == null}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-400">Quanto pretende economizar</span>
              <MoneyInput
                value={savingsTarget}
                onValueChange={setSavingsTarget}
                placeholder="Ex: 500,00"
                invalid={error != null && savingsTarget.trim() !== "" && parseBRL(savingsTarget) == null}
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="text-xs text-rose-400">
              {error}
            </p>
          )}
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
          {progress.spendingLimit != null && progress.spendingLimit > 0 && (
            <div className="flex items-center gap-4">
              <BudgetJar remaining={Math.max(0, progress.spendingLimit - progress.spentThisMonth) / progress.spendingLimit} />
              <div className="min-w-0">
                <p className="text-xs text-zinc-500">Restam do orçamento</p>
                <p className="text-2xl font-semibold tracking-tight text-white">
                  {formatCurrency(Math.max(0, progress.spendingLimit - progress.spentThisMonth))}
                </p>
                <p className="text-xs text-zinc-500">
                  de {formatCurrency(progress.spendingLimit)} · {progress.daysInMonth - progress.daysElapsed}{" "}
                  {progress.daysInMonth - progress.daysElapsed === 1 ? "dia" : "dias"} para acabar o mês
                </p>
                {progress.spentThisMonth > progress.spendingLimit && (
                  <p className="mt-1 text-xs font-medium text-rose-300">
                    Passou {formatCurrency(progress.spentThisMonth - progress.spendingLimit)} do limite
                  </p>
                )}
              </div>
            </div>
          )}
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
