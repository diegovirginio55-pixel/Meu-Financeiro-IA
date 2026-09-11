"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/finance/format";
import { suggestMonthlyContribution } from "@/lib/finance/goal-suggestion";
import type { MonthlyBudget } from "@/lib/finance/budget";
import type { Goal, Transaction } from "@/lib/finance/types";
import { PageHero, PageShell, SectionLabel, SoftPanel } from "@/components/ui/page-chrome";
import { MonthlyBudgetCard } from "@/components/metas/MonthlyBudgetCard";

interface Contribution {
  id: string;
  amount: number;
  created_at: string;
}

function GoalCard({ goal, onRefresh }: { goal: Goal; onRefresh: () => Promise<void> }) {
  const [expanded, setExpanded] = useState(false);
  const [contributions, setContributions] = useState<Contribution[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(goal.name);
  const [target, setTarget] = useState(String(goal.target_amount));
  const [deadline, setDeadline] = useState(goal.deadline ?? "");
  const [saving, setSaving] = useState(false);

  const progress = Math.min(100, Math.round((Number(goal.current_amount) / Math.max(1, Number(goal.target_amount))) * 100));
  const done = Number(goal.current_amount) >= Number(goal.target_amount);

  async function loadContributions() {
    const res = await fetch(`/api/goals/${goal.id}/contributions`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setContributions(data.contributions ?? []);
    }
  }

  async function toggleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && contributions == null) await loadContributions();
  }

  async function handleAddAmount() {
    const input = window.prompt(`Quanto guardar para "${goal.name}"?`, "");
    if (!input) return;
    const amount = Number(input.replace(",", "."));
    if (!Number.isFinite(amount) || amount === 0) return;
    await fetch(`/api/goals/${goal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ add_amount: amount }),
    });
    setContributions(null);
    await onRefresh();
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      await fetch(`/api/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          target_amount: Number(target.replace(",", ".")),
          deadline: deadline || null,
        }),
      });
      setEditing(false);
      await onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Excluir a meta "${goal.name}"?`)) return;
    await fetch(`/api/goals/${goal.id}`, { method: "DELETE" });
    await onRefresh();
  }

  return (
    <SoftPanel className="p-4">
      {editing ? (
        <div className="flex flex-col gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              inputMode="decimal"
              placeholder="Valor objetivo"
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
            />
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleSaveEdit()}
              disabled={saving}
              className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-zinc-950 disabled:opacity-50"
            >
              {saving ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-zinc-400">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-100">
                {goal.name} {done && <span className="ml-1 text-emerald-400">✓</span>}
              </p>
              {goal.deadline && (
                <p className="text-xs text-zinc-500">
                  até {new Date(`${goal.deadline}T12:00:00`).toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>
            <p className="shrink-0 whitespace-nowrap text-sm text-zinc-300">
              {formatCurrency(Number(goal.current_amount))} / {formatCurrency(Number(goal.target_amount))}
            </p>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full rounded-full ${done ? "bg-emerald-400" : "bg-emerald-500"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
            <button type="button" onClick={() => void toggleExpand()} className="hover:text-zinc-300">
              {expanded ? "ocultar histórico" : "ver histórico de aportes"}
            </button>
            <div className="flex gap-3">
              <button type="button" onClick={() => void handleAddAmount()} className="text-emerald-400 hover:text-emerald-300">
                + guardar
              </button>
              <button type="button" onClick={() => setEditing(true)} className="text-zinc-500 hover:text-zinc-300">
                editar
              </button>
              <button type="button" onClick={() => void handleDelete()} className="text-zinc-500 hover:text-red-400">
                excluir
              </button>
            </div>
          </div>
          {expanded && (
            <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
              {contributions == null ? (
                <p className="text-xs text-zinc-500">Carregando…</p>
              ) : contributions.length === 0 ? (
                <p className="text-xs text-zinc-500">Nenhum aporte registrado ainda.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {contributions.map((c) => (
                    <li key={c.id} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">
                        {new Date(c.created_at).toLocaleDateString("pt-BR")}
                      </span>
                      <span className={Number(c.amount) >= 0 ? "text-emerald-400" : "text-rose-300"}>
                        {Number(c.amount) >= 0 ? "+" : ""}
                        {formatCurrency(Number(c.amount))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </SoftPanel>
  );
}

export default function MetasClient({
  initialGoals,
  historyTx,
  initialBudget,
}: {
  initialGoals: Goal[];
  historyTx: Transaction[];
  initialBudget: MonthlyBudget | null;
}) {
  const [goals, setGoals] = useState(initialGoals);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestion = useMemo(() => suggestMonthlyContribution(historyTx), [historyTx]);

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

  function applySuggestion() {
    setFormOpen(true);
    setName("Reserva de emergência");
    setTarget(String(suggestion * 6));
  }

  const activeGoals = goals.filter((g) => Number(g.current_amount) < Number(g.target_amount));
  const doneGoals = goals.filter((g) => Number(g.current_amount) >= Number(g.target_amount));

  return (
    <PageShell>
      <PageHero kicker="Metas" title="Suas metas de economia" subtitle={`${goals.length} meta(s) cadastrada(s)`} />

      <div className="flex flex-col gap-6 px-4 pb-2 lg:px-6 xl:px-10 2xl:px-14">
        <MonthlyBudgetCard historyTx={historyTx} initialBudget={initialBudget} />

        {suggestion > 0 && (
          <SoftPanel className="border-emerald-800/50 bg-emerald-950/15 p-4">
            <p className="text-sm text-emerald-100">
              💡 Com base na sua capacidade de economia recente, você conseguiria guardar cerca de{" "}
              <span className="font-semibold">{formatCurrency(suggestion)}/mês</span> sem apertar o orçamento.
            </p>
            <button
              type="button"
              onClick={applySuggestion}
              className="mt-2 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
            >
              Criar meta com essa base
            </button>
          </SoftPanel>
        )}

        <SoftPanel className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <SectionLabel>Nova meta</SectionLabel>
            <button
              type="button"
              onClick={() => setFormOpen((open) => !open)}
              className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              {formOpen ? "Cancelar" : "+ Nova meta"}
            </button>
          </div>
          {formOpen && (
            <div className="flex flex-col gap-2">
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
        </SoftPanel>

        {goals.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhuma meta criada ainda. Que tal começar uma?</p>
        ) : (
          <div className="flex flex-col gap-4">
            {activeGoals.length > 0 && (
              <div>
                <SectionLabel>Em andamento</SectionLabel>
                <div className="flex flex-col gap-3">
                  {activeGoals.map((goal) => (
                    <GoalCard key={goal.id} goal={goal} onRefresh={refresh} />
                  ))}
                </div>
              </div>
            )}
            {doneGoals.length > 0 && (
              <div>
                <SectionLabel>Concluídas</SectionLabel>
                <div className="flex flex-col gap-3">
                  {doneGoals.map((goal) => (
                    <GoalCard key={goal.id} goal={goal} onRefresh={refresh} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}
