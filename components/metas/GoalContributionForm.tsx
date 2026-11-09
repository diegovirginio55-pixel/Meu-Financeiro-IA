"use client";

import { useId, useState } from "react";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { parseBRL } from "@/lib/ui/money";

/**
 * Formulário em linha para guardar (ou retirar) dinheiro de uma meta — substitui o window.prompt,
 * que no celular não tem teclado numérico e aceitava "1.500" como 1,5.
 */
export function GoalContributionForm({
  goalId,
  goalName,
  onDone,
  onCancel,
}: {
  goalId: string;
  goalName: string;
  onDone: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const inputId = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(direction: 1 | -1) {
    const amount = parseBRL(value);
    if (amount == null || amount <= 0) {
      setError("Informe um valor válido, por exemplo 150,00.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/goals/${goalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ add_amount: direction * amount }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Não foi possível registrar o valor.");
      setValue("");
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível registrar o valor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit(1);
      }}
      className="mt-2 flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3"
    >
      <label htmlFor={inputId} className="text-xs text-zinc-400">
        Quanto guardar para “{goalName}”?
      </label>
      <MoneyInput
        id={inputId}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          if (error) setError(null);
        }}
        invalid={error != null}
        autoFocus
      />
      {error && (
        <p role="alert" className="text-xs text-rose-400">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? "Salvando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => void submit(-1)}
          disabled={saving}
          className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
        >
          Retirar
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className="text-xs text-zinc-400 hover:text-zinc-200">
          Cancelar
        </button>
      </div>
    </form>
  );
}
