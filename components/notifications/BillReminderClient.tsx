"use client";

import Link from "next/link";
import { useState } from "react";
import { PageShell, SectionLabel, SoftPanel } from "@/components/ui/page-chrome";
import { formatCurrency, formatDate } from "@/lib/finance/format";

/**
 * Aberta ao tocar no lembrete de conta a pagar. Tem o mesmo botão
 * "Já paguei" da notificação — necessário no iPhone, que não mostra botões
 * em notificações de app instalado pelo navegador.
 */
export default function BillReminderClient({
  token,
  description,
  amount,
  dueDate,
  alreadyPaid,
}: {
  token: string;
  description: string;
  amount: number;
  dueDate: string;
  alreadyPaid: boolean;
}) {
  const [paid, setPaid] = useState(alreadyPaid);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markPaid() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/push/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "paid" }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Não foi possível marcar como paga.");
      setPaid(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível marcar como paga.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pt-2 lg:px-6">
        <SectionLabel>Conta a pagar</SectionLabel>
        <SoftPanel className="p-4">
          <p className="text-sm text-zinc-400">Vence em {formatDate(dueDate)}</p>
          <p className="mt-1 break-words text-base font-medium text-zinc-100">{description}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-100">{formatCurrency(amount)}</p>
        </SoftPanel>

        {paid ? (
          <p role="status" className="text-sm text-emerald-300">
            ✅ Conta marcada como paga. Não vou lembrar de novo deste vencimento.
          </p>
        ) : (
          <button
            type="button"
            onClick={markPaid}
            disabled={saving}
            className="min-h-12 rounded-full bg-emerald-500 px-5 py-3 text-base font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            {saving ? "Salvando…" : "✅ Já paguei"}
          </button>
        )}

        {error && (
          <p role="alert" className="text-sm text-rose-400">
            {error}
          </p>
        )}

        <Link href="/mes" className="text-sm font-medium text-emerald-300 hover:underline">
          Ver calendário de contas
        </Link>
      </div>
    </PageShell>
  );
}
