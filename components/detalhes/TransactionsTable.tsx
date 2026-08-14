"use client";

import { useState } from "react";
import { formatCurrency, formatDate } from "@/lib/finance/format";
import { CATEGORIES, CATEGORY_ICONS } from "@/lib/finance/categories";
import type { Account, Card, Transaction } from "@/lib/finance/types";

interface EditableFields {
  description: string;
  amount: string;
  type: "entrada" | "saida";
  category: string;
  date: string;
}

function toEditable(t: Transaction): EditableFields {
  return {
    description: t.description,
    amount: String(t.amount),
    type: t.type,
    category: t.category,
    date: t.date,
  };
}

export default function TransactionsTable({
  transactions,
  accounts,
  cards,
  onUpdate,
  onDelete,
}: {
  transactions: Transaction[];
  accounts: Account[];
  cards: Card[];
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditableFields | null>(null);
  const [saving, setSaving] = useState(false);

  function accountOrCardLabel(t: Transaction) {
    if (t.card_id) return cards.find((c) => c.id === t.card_id)?.name ?? "Cartão";
    if (t.account_id) return accounts.find((a) => a.id === t.account_id)?.name ?? "Conta";
    return "—";
  }

  function startEdit(t: Transaction) {
    setEditingId(t.id);
    setDraft(toEditable(t));
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function saveEdit(id: string) {
    if (!draft) return;
    setSaving(true);
    try {
      await onUpdate(id, {
        description: draft.description,
        amount: Number(draft.amount),
        type: draft.type,
        category: draft.category,
        date: draft.date,
      });
      setEditingId(null);
      setDraft(null);
    } finally {
      setSaving(false);
    }
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center text-sm text-zinc-500">
        Nenhum lançamento encontrado para esses filtros.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-zinc-400">
            <th className="px-4 py-3 font-medium">Data</th>
            <th className="px-4 py-3 font-medium">Descrição</th>
            <th className="px-4 py-3 font-medium">Categoria</th>
            <th className="px-4 py-3 font-medium">Conta/Cartão</th>
            <th className="px-4 py-3 text-right font-medium">Valor</th>
            <th className="px-4 py-3 text-right font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => {
            const isEditing = editingId === t.id;
            return (
              <tr key={t.id} className="border-b border-zinc-800/60 last:border-0">
                <td className="px-4 py-2.5 text-zinc-300">
                  {isEditing ? (
                    <input
                      type="date"
                      value={draft?.date}
                      onChange={(e) => setDraft((d) => d && { ...d, date: e.target.value })}
                      className="w-32 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-1 text-zinc-200"
                    />
                  ) : (
                    formatDate(t.date)
                  )}
                </td>
                <td className="px-4 py-2.5 text-zinc-100">
                  {isEditing ? (
                    <input
                      value={draft?.description}
                      onChange={(e) => setDraft((d) => d && { ...d, description: e.target.value })}
                      className="w-40 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-1 text-zinc-200"
                    />
                  ) : (
                    t.description
                  )}
                </td>
                <td className="px-4 py-2.5 text-zinc-300">
                  {isEditing ? (
                    <select
                      value={draft?.category}
                      onChange={(e) => setDraft((d) => d && { ...d, category: e.target.value })}
                      className="rounded border border-zinc-700 bg-zinc-950 px-1.5 py-1 text-zinc-200"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <span>{CATEGORY_ICONS[t.category] ?? "🔖"}</span>
                      {t.category}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-zinc-400">{accountOrCardLabel(t)}</td>
                <td className="px-4 py-2.5 text-right">
                  {isEditing ? (
                    <div className="flex items-center justify-end gap-1.5">
                      <select
                        value={draft?.type}
                        onChange={(e) =>
                          setDraft((d) => d && { ...d, type: e.target.value as "entrada" | "saida" })
                        }
                        className="rounded border border-zinc-700 bg-zinc-950 px-1 py-1 text-zinc-200"
                      >
                        <option value="entrada">Entrada</option>
                        <option value="saida">Saída</option>
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        value={draft?.amount}
                        onChange={(e) => setDraft((d) => d && { ...d, amount: e.target.value })}
                        className="w-24 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-1 text-right text-zinc-200"
                      />
                    </div>
                  ) : (
                    <span
                      className={`font-medium ${t.type === "entrada" ? "text-emerald-400" : "text-red-400"}`}
                    >
                      {t.type === "entrada" ? "+" : "-"}
                      {formatCurrency(Number(t.amount))}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {isEditing ? (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => saveEdit(t.id)}
                        disabled={saving}
                        className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        Salvar
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-3 text-xs">
                      <button
                        onClick={() => startEdit(t)}
                        className="text-zinc-400 hover:text-emerald-400"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => onDelete(t.id)}
                        className="text-zinc-400 hover:text-red-400"
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
