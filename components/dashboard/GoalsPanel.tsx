"use client";

import { useId, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/finance/format";
import type { Goal } from "@/lib/finance/types";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { GoalContributionForm } from "@/components/metas/GoalContributionForm";
import { parseBRL } from "@/lib/ui/money";

export default function GoalsPanel({ initialGoals }: { initialGoals: Goal[] }) {
  // Lista recarregada localmente vale até o servidor mandar outra (`initialGoals` muda) — derivado, sem efeito.
  const [localGoals, setLocalGoals] = useState<{ base: Goal[]; list: Goal[] } | null>(null);
  const goals = localGoals && localGoals.base === initialGoals ? localGoals.list : initialGoals;
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contributingId, setContributingId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const formId = useId();

  async function refresh() {
    const res = await fetch("/api/goals", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setLocalGoals({ base: initialGoals, list: data.goals ?? [] });
    }
  }

  async function handleCreate() {
    setError(null);
    const targetAmount = parseBRL(target);
    if (!name.trim() || targetAmount == null || targetAmount <= 0) {
      setError("Informe um nome e um valor objetivo válido (ex.: 1.500,00).");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), target_amount: targetAmount, deadline: deadline || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível criar a meta.");
      setName("");
      setTarget("");
      setDeadline("");
      setFormOpen(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a meta.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(goal: Goal) {
    if (!window.confirm(`Excluir a meta "${goal.name}"?`)) return;
    setListError(null);
    try {
      const res = await fetch(`/api/goals/${goal.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setListError(data.error || "Não foi possível excluir a meta.");
        return;
      }
      await refresh();
    } catch {
      setListError("Não foi possível excluir a meta. Verifique sua conexão.");
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-300">🎯 Metas</h2>
        <button
          type="button"
          onClick={() => setFormOpen((open) => !open)}
          className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          {formOpen ? "Cancelar" : "+ Nova meta"}
        </button>
      </div>

      {formOpen && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da meta (ex: Viagem, Reserva de emergência)"
            aria-label="Nome da meta"
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <MoneyInput
              id={`${formId}-target`}
              value={target}
              onValueChange={setTarget}
              placeholder="Valor objetivo"
              aria-label="Valor objetivo"
              invalid={error != null && parseBRL(target) == null}
            />
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              aria-label="Prazo"
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
            />
          </div>
          {error && (
            <p role="alert" className="text-xs text-rose-400">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={saving}
            className="self-start rounded-full bg-white px-4 py-2 text-xs font-medium text-zinc-950 disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Criar meta"}
          </button>
        </div>
      )}

      {listError && (
        <p role="alert" className="mb-3 text-xs text-rose-400">
          {listError}
        </p>
      )}

      {goals.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma meta criada ainda. Que tal começar uma?</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {goals.map((goal) => {
            const progress = Math.min(
              100,
              Math.round((Number(goal.current_amount) / Math.max(1, Number(goal.target_amount))) * 100),
            );
            return (
              <li key={goal.id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm text-zinc-300">
                  <span className="min-w-0 truncate">
                    {goal.name}
                    {goal.deadline && (
                      <span className="ml-1.5 text-xs text-zinc-500">
                        até {formatDate(goal.deadline)}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 whitespace-nowrap">
                    {formatCurrency(Number(goal.current_amount))} / {formatCurrency(Number(goal.target_amount))}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-1.5 flex justify-end gap-3 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setContributingId((current) => (current === goal.id ? null : goal.id))}
                    aria-expanded={contributingId === goal.id}
                    className="text-emerald-400 hover:text-emerald-300"
                  >
                    + guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(goal)}
                    className="text-zinc-400 hover:text-red-400"
                  >
                    excluir
                  </button>
                </div>
                {contributingId === goal.id && (
                  <GoalContributionForm
                    goalId={goal.id}
                    goalName={goal.name}
                    onCancel={() => setContributingId(null)}
                    onDone={async () => {
                      setContributingId(null);
                      await refresh();
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
