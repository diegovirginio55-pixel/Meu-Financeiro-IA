"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/finance/format";
import type { Goal } from "@/lib/finance/types";

export default function GoalsPanel({ initialGoals }: { initialGoals: Goal[] }) {
  const [goals, setGoals] = useState(initialGoals);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setGoals(initialGoals);
  }, [initialGoals]);

  async function refresh() {
    const res = await fetch("/api/goals", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setGoals(data.goals ?? []);
    }
  }

  async function handleCreate() {
    setError(null);
    const targetAmount = Number(target.replace(",", "."));
    if (!name.trim() || !Number.isFinite(targetAmount) || targetAmount <= 0) {
      setError("Informe um nome e um valor objetivo válido.");
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

  async function handleAddAmount(goal: Goal) {
    const input = window.prompt(`Quanto guardar para "${goal.name}"?`, "");
    if (!input) return;
    const amount = Number(input.replace(",", "."));
    if (!Number.isFinite(amount) || amount === 0) return;
    await fetch(`/api/goals/${goal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ add_amount: amount }),
    });
    await refresh();
  }

  async function handleDelete(goal: Goal) {
    if (!window.confirm(`Excluir a meta "${goal.name}"?`)) return;
    await fetch(`/api/goals/${goal.id}`, { method: "DELETE" });
    await refresh();
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
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Valor objetivo"
              inputMode="decimal"
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
            />
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
            />
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
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

      {goals.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma meta criada ainda. Que tal começar uma?</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {goals.map((goal) => {
            const progress = Math.min(
              100,
              Math.round((Number(goal.current_amount) / Number(goal.target_amount)) * 100),
            );
            return (
              <li key={goal.id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm text-zinc-300">
                  <span className="min-w-0 truncate">
                    {goal.name}
                    {goal.deadline && (
                      <span className="ml-1.5 text-xs text-zinc-500">
                        até {new Date(`${goal.deadline}T12:00:00`).toLocaleDateString("pt-BR")}
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
                    onClick={() => void handleAddAmount(goal)}
                    className="text-emerald-400 hover:text-emerald-300"
                  >
                    + guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(goal)}
                    className="text-zinc-500 hover:text-red-400"
                  >
                    excluir
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
