"use client";

import { useState } from "react";
import { formatCurrency, formatDate } from "@/lib/finance/format";
import { CATEGORIES, CATEGORY_ICONS } from "@/lib/finance/categories";
import { MerchantAvatar } from "@/components/ui/MerchantAvatar";
import type { Account, Card, Transaction } from "@/lib/finance/types";
import { accountBankLabel, cardBankLabel } from "@/lib/finance/account-name";
import { usePhoneLayout } from "@/lib/ui/use-phone-layout";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { formatBRLInput, parseBRL } from "@/lib/ui/money";

/** Lançamento que veio da notificação do banco no celular e ainda espera a confirmação da Pluggy. */
function isProvisional(transaction: Transaction): boolean {
  return Boolean(transaction.pluggy_transaction_id?.startsWith("notif:"));
}

function ProvisionalTag() {
  return (
    <span
      title="Veio da notificação do banco no celular. Será trocado pelo lançamento oficial quando o banco atualizar."
      className="ml-1.5 inline-block rounded-full bg-amber-500/15 px-1.5 py-px text-[10px] font-medium text-amber-300"
    >
      ⏳ provisório
    </span>
  );
}

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
    amount: formatBRLInput(Number(t.amount)),
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
  selectedIds,
  onToggleSelect,
  onSelectAll,
}: {
  transactions: Transaction[];
  accounts: Account[];
  cards: Card[];
  /** Deve lançar um Error com a mensagem da API quando não salvar. */
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAll?: (ids: string[], select: boolean) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditableFields | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const phone = usePhoneLayout();
  const selectable = Boolean(onToggleSelect);

  function accountOrCardLabel(t: Transaction) {
    if (t.card_id) {
      const card = cards.find((c) => c.id === t.card_id);
      return card ? cardBankLabel(card) : "Cartão";
    }
    if (t.account_id) {
      const account = accounts.find((a) => a.id === t.account_id);
      return account ? accountBankLabel(account) : "Conta";
    }
    return "—";
  }

  function startEdit(t: Transaction) {
    setEditingId(t.id);
    setDraft(toEditable(t));
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
    setEditError(null);
  }

  async function saveEdit(id: string) {
    if (!draft || saving) return;
    const amount = parseBRL(draft.amount);
    if (amount == null || amount <= 0) {
      setEditError("Informe um valor válido, por exemplo 1.500,00.");
      return;
    }
    if (!draft.description.trim()) {
      setEditError("Informe uma descrição.");
      return;
    }
    setEditError(null);
    setSaving(true);
    try {
      await onUpdate(id, {
        description: draft.description.trim(),
        amount,
        type: draft.type,
        category: draft.category,
        date: draft.date,
      });
      // Só fecha a edição quando o servidor confirmou.
      setEditingId(null);
      setDraft(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Não foi possível salvar o lançamento.");
    } finally {
      setSaving(false);
    }
  }

  const amountInvalid = editError != null && draft != null && parseBRL(draft.amount) == null;
  const errorMessage = editError ? (
    <p role="alert" className="text-xs text-rose-400">
      {editError}
    </p>
  ) : null;

  if (transactions.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-zinc-500">Nenhum lançamento neste filtro.</p>;
  }

  if (phone) {
    return (
      <div className="flex flex-col">
        {transactions.map((t, index) => {
          const isEditing = editingId === t.id;
          return (
            <div key={t.id} className={`px-4 py-3 ${index > 0 ? "border-t border-zinc-800" : ""}`}>
              {isEditing && draft ? (
                <div className="flex flex-col gap-2">
                  <input
                    value={draft.description}
                    onChange={(e) => setDraft((d) => d && { ...d, description: e.target.value })}
                    aria-label="Descrição"
                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={draft.date}
                      onChange={(e) => setDraft((d) => d && { ...d, date: e.target.value })}
                      aria-label="Data"
                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                    />
                    <MoneyInput
                      value={draft.amount}
                      onValueChange={(value) => setDraft((d) => d && { ...d, amount: value })}
                      aria-label="Valor"
                      invalid={amountInvalid}
                    />
                  </div>
                  {errorMessage}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void saveEdit(t.id)}
                      disabled={saving}
                      className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-zinc-950 disabled:opacity-50"
                    >
                      {saving ? "Salvando…" : "Salvar"}
                    </button>
                    <button type="button" onClick={cancelEdit} disabled={saving} className="text-xs text-zinc-400">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    {selectable && (
                      <input
                        type="checkbox"
                        checked={selectedIds?.has(t.id) ?? false}
                        onChange={() => onToggleSelect?.(t.id)}
                        aria-label={`Selecionar ${t.description}`}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-700 bg-zinc-900 accent-emerald-500"
                      />
                    )}
                    <MerchantAvatar description={t.description} category={t.category} size={34} />
                    <button type="button" onClick={() => startEdit(t)} className="min-w-0 text-left">
                      <span className="block truncate text-sm text-zinc-100">{t.description}</span>
                      <span className="text-xs text-zinc-500">
                        {formatDate(t.date)} · {CATEGORY_ICONS[t.category] ?? "🔖"} {t.category}
                        {isProvisional(t) && <ProvisionalTag />}
                      </span>
                    </button>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-sm font-medium ${t.type === "entrada" ? "text-emerald-400" : "text-rose-300"}`}>
                      {t.type === "entrada" ? "+" : "−"}
                      {formatCurrency(Number(t.amount))}
                    </p>
                    <button
                      type="button"
                      onClick={() => void onDelete(t.id)}
                      aria-label={`Excluir ${t.description}`}
                      className="text-[11px] text-zinc-400"
                    >
                      excluir
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-zinc-400">
            {selectable && (
              <th className="px-4 py-3 font-medium">
                <input
                  type="checkbox"
                  checked={transactions.length > 0 && transactions.every((t) => selectedIds?.has(t.id))}
                  onChange={(e) => onSelectAll?.(transactions.map((t) => t.id), e.target.checked)}
                  aria-label="Selecionar todos os lançamentos visíveis"
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 accent-emerald-500"
                />
              </th>
            )}
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
                {selectable && (
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(t.id) ?? false}
                      onChange={() => onToggleSelect?.(t.id)}
                      aria-label={`Selecionar ${t.description}`}
                      className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 accent-emerald-500"
                    />
                  </td>
                )}
                <td className="px-4 py-2.5 text-zinc-300">
                  {isEditing ? (
                    <input
                      type="date"
                      value={draft?.date}
                      onChange={(e) => setDraft((d) => d && { ...d, date: e.target.value })}
                      aria-label="Data"
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
                      aria-label="Descrição"
                      className="w-40 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-1 text-zinc-200"
                    />
                  ) : (
                    <span className="flex items-center gap-2.5">
                      <MerchantAvatar description={t.description} category={t.category} size={28} />
                      <span>
                        {t.description}
                        {isProvisional(t) && <ProvisionalTag />}
                      </span>
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-zinc-300">
                  {isEditing ? (
                    <select
                      value={draft?.category}
                      onChange={(e) => setDraft((d) => d && { ...d, category: e.target.value })}
                      aria-label="Categoria"
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
                      <span aria-hidden>{CATEGORY_ICONS[t.category] ?? "🔖"}</span>
                      {t.category}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-zinc-400">{accountOrCardLabel(t)}</td>
                <td className="px-4 py-2.5 text-right">
                  {isEditing && draft ? (
                    <div className="flex items-center justify-end gap-1.5">
                      <select
                        value={draft.type}
                        onChange={(e) =>
                          setDraft((d) => d && { ...d, type: e.target.value as "entrada" | "saida" })
                        }
                        aria-label="Tipo"
                        className="rounded border border-zinc-700 bg-zinc-950 px-1 py-1 text-zinc-200"
                      >
                        <option value="entrada">Entrada</option>
                        <option value="saida">Saída</option>
                      </select>
                      <MoneyInput
                        value={draft.amount}
                        onValueChange={(value) => setDraft((d) => d && { ...d, amount: value })}
                        aria-label="Valor"
                        invalid={amountInvalid}
                        className="w-36"
                        compact
                        inputClassName="text-right"
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
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void saveEdit(t.id)}
                          disabled={saving}
                          className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {saving ? "Salvando…" : "Salvar"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={saving}
                          className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
                        >
                          Cancelar
                        </button>
                      </div>
                      {errorMessage}
                    </div>
                  ) : (
                    <div className="flex justify-end gap-3 text-xs">
                      <button
                        type="button"
                        onClick={() => startEdit(t)}
                        aria-label={`Editar ${t.description}`}
                        className="text-zinc-400 hover:text-emerald-400"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDelete(t.id)}
                        aria-label={`Excluir ${t.description}`}
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
