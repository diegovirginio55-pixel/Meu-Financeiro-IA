"use client";

import { useEffect, useState } from "react";
import { CATEGORIES } from "@/lib/finance/categories";
import { SoftPanel } from "@/components/ui/page-chrome";

interface CategoryRule {
  id: string;
  pattern: string;
  category: string;
}

export function CategoryRulesPanel({ onApplied }: { onApplied?: () => void }) {
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [pattern, setPattern] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadRules() {
    const res = await fetch("/api/category-rules", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setRules(data.rules ?? []);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carrega as regras ao abrir o painel
    if (open) void loadRules();
  }, [open]);

  async function handleCreate() {
    if (!pattern.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/category-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pattern: pattern.trim(), category }),
      });
      if (res.ok) {
        setPattern("");
        await loadRules();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/category-rules/${id}`, { method: "DELETE" });
    await loadRules();
  }

  async function handleApplyToExisting() {
    setApplying(true);
    setMessage(null);
    try {
      const res = await fetch("/api/transactions?period=todos", { cache: "no-store" });
      const data = await res.json();
      const transactions = (data.transactions ?? []) as { id: string; description: string }[];

      const normalize = (v: string) =>
        v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

      const byCategory = new Map<string, string[]>();
      for (const t of transactions) {
        const text = normalize(t.description);
        const match = rules.find((r) => normalize(r.pattern) && text.includes(normalize(r.pattern)));
        if (!match) continue;
        const list = byCategory.get(match.category) ?? [];
        list.push(t.id);
        byCategory.set(match.category, list);
      }

      let total = 0;
      for (const [cat, ids] of byCategory) {
        await fetch("/api/transactions/bulk", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, category: cat }),
        });
        total += ids.length;
      }
      setMessage(total > 0 ? `${total} lançamento(s) recategorizado(s).` : "Nenhum lançamento correspondeu às regras.");
      onApplied?.();
    } finally {
      setApplying(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-800"
      >
        ⚙️ Regras de categorização
      </button>
    );
  }

  return (
    <SoftPanel className="mt-3 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-200">Regras de categorização</p>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-zinc-500 hover:text-zinc-300">
          Fechar
        </button>
      </div>
      <p className="mb-3 text-xs text-zinc-500">
        Ex: toda transação com a palavra &quot;uber&quot; vira &quot;Transporte&quot; automaticamente (vale para novas
        transações vindas do banco).
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="Quando a descrição contém..."
          className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={saving || !pattern.trim()}
          className="rounded-full bg-white px-4 py-2 text-xs font-medium text-zinc-950 disabled:opacity-50"
        >
          {saving ? "Salvando…" : "+ Regra"}
        </button>
      </div>

      {rules.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-xs"
            >
              <span className="text-zinc-300">
                &quot;{rule.pattern}&quot; → <span className="text-emerald-400">{rule.category}</span>
              </span>
              <button type="button" onClick={() => void handleDelete(rule.id)} className="text-zinc-500 hover:text-red-400">
                excluir
              </button>
            </li>
          ))}
        </ul>
      )}

      {rules.length > 0 && (
        <button
          type="button"
          onClick={() => void handleApplyToExisting()}
          disabled={applying}
          className="mt-3 rounded-full border border-emerald-700 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-950/40 disabled:opacity-50"
        >
          {applying ? "Aplicando…" : "Aplicar regras aos lançamentos existentes"}
        </button>
      )}
      {message && <p className="mt-2 text-xs text-zinc-400">{message}</p>}
    </SoftPanel>
  );
}
