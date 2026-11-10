"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHero, PageShell, SectionLabel, SoftPanel } from "@/components/ui/page-chrome";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { MerchantAvatar } from "@/components/ui/MerchantAvatar";
import { formatCurrency } from "@/lib/finance/format";
import { CATEGORIES } from "@/lib/finance/categories";
import { formatBRLInput, parseBRL } from "@/lib/ui/money";
import type { BillSide, MonthBill, MonthBillsSummary } from "@/lib/finance/month-bills";

const TONE_STYLE = {
  alerta: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  info: "border-zinc-700 bg-zinc-900/70 text-zinc-300",
  bom: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
} as const;
const TONE_ICON = { alerta: "⚠️", info: "💡", bom: "✅" } as const;

function monthTitle(monthKey: string) {
  const label = format(parseISO(`${monthKey}-01`), "MMMM 'de' yyyy", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function shortDate(key: string) {
  return format(parseISO(key), "dd/MM");
}

function statusBadge(bill: MonthBill, todayKey: string) {
  if (bill.status === "feito") {
    return { text: bill.side === "receber" ? "Recebido" : "Pago", className: "bg-emerald-500/15 text-emerald-300" };
  }
  if (bill.status === "atrasado") {
    return { text: bill.side === "receber" ? "Não caiu ainda" : "Atrasada", className: "bg-rose-500/15 text-rose-300" };
  }
  if (bill.status === "hoje") return { text: "Hoje", className: "bg-amber-500/15 text-amber-300" };
  const days = Math.round((Date.parse(`${bill.dueDate}T12:00:00Z`) - Date.parse(`${todayKey}T12:00:00Z`)) / 86_400_000);
  if (bill.status === "proximo") {
    return { text: days === 1 ? "Amanhã" : `Em ${days} dias`, className: "bg-amber-500/10 text-amber-200" };
  }
  return null;
}

type FormState = {
  side: BillSide;
  description: string;
  amount: string;
  repeat: "mensal" | "uma";
  day: string;
  date: string;
  category: string;
};

function emptyForm(side: BillSide = "pagar"): FormState {
  return {
    side,
    description: "",
    amount: "",
    repeat: "mensal",
    day: "",
    date: "",
    category: side === "receber" ? "Salário" : "Moradia",
  };
}

async function sendJson(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error || "Não foi possível salvar.");
  return data;
}

export default function ContasClient({
  summary,
  accountBalance,
  todayKey,
  prevMonth,
  nextMonth,
}: {
  summary: MonthBillsSummary;
  accountBalance: number;
  todayKey: string;
  prevMonth: string | null;
  nextMonth: string | null;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [form, setForm] = useState<FormState | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { totals } = summary;

  const refresh = () => startRefresh(() => router.refresh());

  async function toggleDone(bill: MonthBill) {
    setBusyId(`${bill.kind}:${bill.id}`);
    setError(null);
    try {
      await sendJson("/api/contas/status", "POST", { kind: bill.kind, id: bill.id, dueDate: bill.dueDate, done: !bill.done });
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível marcar.");
    } finally {
      setBusyId(null);
    }
  }

  const paidPct = totals.pagar > 0 ? Math.min(100, (totals.pago / totals.pagar) * 100) : 0;
  const receivedPct = totals.receber > 0 ? Math.min(100, (totals.recebido / totals.receber) * 100) : 0;

  return (
    <PageShell>
      <PageHero
        kicker="Contas do mês"
        title={monthTitle(summary.monthKey)}
        subtitle="O que você tem para pagar e para receber — e quanto sobra."
        trailing={
          <div className="flex items-center gap-1">
            {prevMonth ? (
              <Link href={`/contas?mes=${prevMonth}`} aria-label="Mês anterior" className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-zinc-300 hover:bg-zinc-800">
                ‹
              </Link>
            ) : null}
            {nextMonth ? (
              <Link href={`/contas?mes=${nextMonth}`} aria-label="Próximo mês" className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-zinc-300 hover:bg-zinc-800">
                ›
              </Link>
            ) : null}
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <SoftPanel className="p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">A receber</p>
            <p className="mt-1 text-xl font-semibold text-emerald-300">{formatCurrency(totals.receber)}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${receivedPct}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-500">
              recebido {formatCurrency(totals.recebido)} · falta {formatCurrency(totals.faltaReceber)}
            </p>
          </SoftPanel>
          <SoftPanel className="p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">A pagar</p>
            <p className="mt-1 text-xl font-semibold text-rose-300">{formatCurrency(totals.pagar)}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full rounded-full bg-rose-400" style={{ width: `${paidPct}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-500">
              pago {formatCurrency(totals.pago)} · falta {formatCurrency(totals.faltaPagar)}
            </p>
          </SoftPanel>
          <SoftPanel className="col-span-2 p-4 lg:col-span-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              {summary.isCurrentMonth ? "Sobra prevista" : "Resultado do mês"}
            </p>
            <p className={`mt-1 text-2xl font-semibold ${totals.sobra >= 0 ? "text-white" : "text-rose-300"}`}>
              {formatCurrency(totals.sobra)}
            </p>
            <p className="mt-1.5 text-[11px] leading-snug text-zinc-500">
              {summary.isCurrentMonth
                ? `saldo em conta ${formatCurrency(accountBalance)} + falta receber − falta pagar`
                : "a receber − a pagar"}
            </p>
          </SoftPanel>
        </div>
      </PageHero>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-10 lg:px-6">
        {summary.suggestions.length > 0 && (
          <section aria-label="Sugestões">
            <SectionLabel>Sugestões</SectionLabel>
            <ul className="flex flex-col gap-2">
              {summary.suggestions.map((tip) => (
                <li key={tip.text} className={`flex gap-2.5 rounded-2xl border px-3.5 py-3 text-sm leading-snug ${TONE_STYLE[tip.tone]}`}>
                  <span aria-hidden>{TONE_ICON[tip.tone]}</span>
                  <span>{tip.text}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        )}

        {form ? (
          <BillForm
            initial={form}
            onCancel={() => setForm(null)}
            onSaved={() => {
              setForm(null);
              refresh();
            }}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setForm(emptyForm("pagar"))}
              className="rounded-full bg-rose-500/90 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
            >
              + Conta a pagar
            </button>
            <button
              type="button"
              onClick={() => setForm(emptyForm("receber"))}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              + Valor a receber
            </button>
            {refreshing && <span className="self-center text-xs text-zinc-500">Atualizando…</span>}
          </div>
        )}

        {(["pagar", "receber"] as const).map((side) => {
          const list = side === "pagar" ? summary.pagar : summary.receber;
          return (
            <section key={side} aria-label={side === "pagar" ? "A pagar" : "A receber"}>
              <SectionLabel>
                {side === "pagar" ? `A pagar · ${list.length}` : `A receber · ${list.length}`}
              </SectionLabel>
              {list.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-zinc-800 px-4 py-5 text-sm text-zinc-500">
                  {side === "pagar"
                    ? "Nenhuma conta a pagar. Adicione água, luz, aluguel, internet…"
                    : "Nada a receber cadastrado. Adicione o seu salário e outras entradas."}
                </p>
              ) : (
                <SoftPanel className="divide-y divide-zinc-800/80">
                  {list.map((bill) => {
                    const key = `${bill.kind}:${bill.id}`;
                    return editing === key ? (
                      <BillEditor
                        key={key}
                        bill={bill}
                        onCancel={() => setEditing(null)}
                        onSaved={() => {
                          setEditing(null);
                          refresh();
                        }}
                      />
                    ) : (
                      <BillRow
                        key={key}
                        bill={bill}
                        todayKey={todayKey}
                        busy={busyId === key}
                        onToggle={() => void toggleDone(bill)}
                        onEdit={bill.fromBank ? undefined : () => setEditing(key)}
                      />
                    );
                  })}
                </SoftPanel>
              )}
            </section>
          );
        })}

        <p className="text-xs leading-relaxed text-zinc-500">
          🔔 Você recebe um aviso na véspera e no dia de cada vencimento (e no dia em que o dinheiro deve cair), com o
          botão “Já paguei” direto na notificação. As faturas dos cartões dos bancos entram sozinhas.
        </p>
      </div>
    </PageShell>
  );
}

function BillRow({
  bill,
  todayKey,
  busy,
  onToggle,
  onEdit,
}: {
  bill: MonthBill;
  todayKey: string;
  busy: boolean;
  onToggle: () => void;
  onEdit?: () => void;
}) {
  const badge = statusBadge(bill, todayKey);
  const detail = bill.fromBank
    ? `vence ${shortDate(bill.dueDate)} · fatura do banco`
    : bill.recurring
      ? `todo dia ${Number(bill.dueDate.slice(8, 10))}`
      : `vence ${shortDate(bill.dueDate)} · uma vez`;
  const doneLabel = bill.side === "receber" ? "recebido" : "pago";

  return (
    <div className={`flex flex-col gap-2 px-3.5 py-3 ${bill.done ? "opacity-70" : ""}`}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          disabled={busy}
          aria-pressed={bill.done}
          aria-label={bill.done ? `Desmarcar ${bill.description} como ${doneLabel}` : `Marcar ${bill.description} como ${doneLabel}`}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm transition disabled:opacity-50 ${
            bill.done ? "border-emerald-400 bg-emerald-500 text-zinc-950" : "border-zinc-600 text-transparent hover:border-emerald-400"
          }`}
        >
          ✓
        </button>
        <MerchantAvatar description={bill.description} category={bill.category} size={32} />
        <button type="button" onClick={onEdit} disabled={!onEdit} className="min-w-0 flex-1 text-left disabled:cursor-default">
          <span className={`block truncate text-sm ${bill.done ? "text-zinc-400 line-through" : "text-zinc-100"}`}>
            {bill.description}
          </span>
          <span className="text-xs text-zinc-500">{detail}</span>
        </button>
        <div className="shrink-0 text-right">
          <p className={`text-sm font-medium ${bill.side === "receber" ? "text-emerald-300" : "text-rose-200"}`}>
            {formatCurrency(bill.amount)}
          </p>
          {badge && <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}>{badge.text}</span>}
        </div>
      </div>
      {bill.match && !bill.done && (
        <div className="ml-10 flex items-center justify-between gap-2 rounded-xl bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
          <span className="min-w-0 truncate">
            No extrato: {bill.match.description} · {shortDate(bill.match.date)} · {formatCurrency(bill.match.amount)}
          </span>
          <button type="button" onClick={onToggle} disabled={busy} className="shrink-0 font-medium text-sky-100 underline disabled:opacity-50">
            Marcar
          </button>
        </div>
      )}
    </div>
  );
}

function CategorySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Categoria"
      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-base text-zinc-100"
    >
      {CATEGORIES.map((category) => (
        <option key={category} value={category}>
          {category}
        </option>
      ))}
    </select>
  );
}

const inputClass = "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-base text-zinc-100 outline-none focus:border-emerald-500";

function BillForm({ initial, onCancel, onSaved }: { initial: FormState; onCancel: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const oneOff = form.side === "pagar" && form.repeat === "uma";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const amount = parseBRL(form.amount);
    if (!form.description.trim()) return setError("Dê um nome, ex.: Conta de luz.");
    if (amount === null || amount <= 0) return setError("Digite o valor, ex.: 150,00.");
    setBusy(true);
    setError(null);
    try {
      await sendJson("/api/contas", "POST", {
        side: form.side,
        description: form.description,
        amount,
        recurring: !oneOff,
        day: oneOff ? undefined : Number(form.day),
        dueDate: oneOff ? form.date : undefined,
        category: form.category,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
      setBusy(false);
    }
  }

  return (
    <SoftPanel className="p-4">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex gap-1 rounded-full border border-zinc-800 bg-zinc-950/60 p-1" role="radiogroup" aria-label="Tipo">
          {(["pagar", "receber"] as const).map((side) => (
            <button
              key={side}
              type="button"
              role="radio"
              aria-checked={form.side === side}
              onClick={() => setForm((current) => ({ ...current, side, category: side === "receber" ? "Salário" : current.category === "Salário" ? "Moradia" : current.category }))}
              className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium ${
                form.side === side ? (side === "pagar" ? "bg-rose-500 text-white" : "bg-emerald-600 text-white") : "text-zinc-400"
              }`}
            >
              {side === "pagar" ? "A pagar" : "A receber"}
            </button>
          ))}
        </div>
        <input
          value={form.description}
          onChange={(event) => set("description", event.target.value)}
          placeholder={form.side === "pagar" ? "Ex.: Conta de luz" : "Ex.: Salário"}
          aria-label="Nome"
          maxLength={80}
          className={inputClass}
          autoFocus
        />
        <MoneyInput value={form.amount} onValueChange={(value) => set("amount", value)} aria-label="Valor" />
        {form.side === "pagar" && (
          <div className="flex gap-2 text-sm">
            {(["mensal", "uma"] as const).map((repeat) => (
              <label key={repeat} className="flex items-center gap-1.5 text-zinc-300">
                <input type="radio" name="repeat" checked={form.repeat === repeat} onChange={() => set("repeat", repeat)} className="accent-emerald-500" />
                {repeat === "mensal" ? "Todo mês" : "Só uma vez"}
              </label>
            ))}
          </div>
        )}
        {oneOff ? (
          <input type="date" value={form.date} onChange={(event) => set("date", event.target.value)} aria-label="Data de vencimento" className={inputClass} />
        ) : (
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            value={form.day}
            onChange={(event) => set("day", event.target.value)}
            placeholder={form.side === "pagar" ? "Dia do vencimento (ex.: 10)" : "Dia em que cai (ex.: 5)"}
            aria-label="Dia do mês"
            className={inputClass}
          />
        )}
        {!oneOff && <CategorySelect value={form.category} onChange={(value) => set("category", value)} />}
        {error && (
          <p role="alert" className="text-sm text-rose-400">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {busy ? "Salvando…" : "Salvar"}
          </button>
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">
            Cancelar
          </button>
        </div>
      </form>
    </SoftPanel>
  );
}

function BillEditor({ bill, onCancel, onSaved }: { bill: MonthBill; onCancel: () => void; onSaved: () => void }) {
  const [description, setDescription] = useState(bill.description);
  const [amount, setAmount] = useState(formatBRLInput(bill.amount));
  const [day, setDay] = useState(String(Number(bill.dueDate.slice(8, 10))));
  const [date, setDate] = useState(bill.dueDate);
  const [category, setCategory] = useState(bill.category);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = `/api/contas/${bill.kind}/${bill.id}`;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const value = parseBRL(amount);
    if (value === null || value <= 0) return setError("Digite o valor, ex.: 150,00.");
    setBusy(true);
    setError(null);
    try {
      await sendJson(url, "PATCH", {
        description,
        amount: value,
        ...(bill.recurring ? { day: Number(day), category } : { dueDate: date }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Remover “${bill.description}” das contas?`)) return;
    setBusy(true);
    try {
      await sendJson(url, "DELETE");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível remover.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2.5 bg-zinc-950/40 px-3.5 py-3">
      <input value={description} onChange={(event) => setDescription(event.target.value)} aria-label="Nome" maxLength={80} className={inputClass} />
      <MoneyInput value={amount} onValueChange={setAmount} aria-label="Valor" />
      {bill.recurring ? (
        <>
          <input type="number" inputMode="numeric" min={1} max={31} value={day} onChange={(event) => setDay(event.target.value)} aria-label="Dia do mês" className={inputClass} />
          <CategorySelect value={category} onChange={setCategory} />
        </>
      ) : (
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Data de vencimento" className={inputClass} />
      )}
      {error && (
        <p role="alert" className="text-sm text-rose-400">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy} className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60">
          Salvar
        </button>
        <button type="button" onClick={onCancel} className="rounded-full px-3 py-1.5 text-sm text-zinc-400">
          Cancelar
        </button>
        <button type="button" onClick={() => void remove()} disabled={busy} className="ml-auto text-sm text-rose-400 hover:underline disabled:opacity-60">
          Remover
        </button>
      </div>
    </form>
  );
}
