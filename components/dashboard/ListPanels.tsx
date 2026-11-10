import { formatCurrency, formatDate } from "@/lib/finance/format";
import { categoryColor, resolvedCategory } from "@/lib/finance/categories";
import { MerchantAvatar } from "@/components/ui/MerchantAvatar";
import type { FinancialSnapshot } from "@/lib/finance/summary";
import type { Transaction } from "@/lib/finance/types";

export function MaioresGastos({
  items,
}: {
  items: Transaction[];
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
      <h2 className="mb-3 text-sm font-medium text-zinc-300">
        🔥 Maiores gastos do mês
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma despesa registrada.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((t) => {
            const category = resolvedCategory(t);
            const share = Number(items[0].amount) > 0 ? (Number(t.amount) / Number(items[0].amount)) * 100 : 0;
            return (
              <li key={t.id} className="flex items-center gap-3 text-sm">
                <MerchantAvatar description={t.description} category={category} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-zinc-200">{t.description}</span>
                  <span className="text-[11px] text-zinc-500">
                    {category} · {formatDate(t.date)}
                  </span>
                  <span className="mt-1 block h-1 overflow-hidden rounded bg-zinc-800">
                    <span className="block h-full rounded" style={{ width: `${share}%`, background: categoryColor(category) }} />
                  </span>
                </span>
                <span className="shrink-0 font-medium text-rose-300">{formatCurrency(Number(t.amount))}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ProximasContas({
  items,
  saldoPrevisto,
}: {
  items: FinancialSnapshot["proximos30Dias"];
  saldoPrevisto: number;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-300">
          📅 Próximos 30 dias
        </h2>
        <span
          className={`text-sm font-semibold ${saldoPrevisto >= 0 ? "text-emerald-400" : "text-red-400"}`}
        >
          Saldo previsto: {formatCurrency(saldoPrevisto)}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Nada previsto para os próximos 30 dias.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item, idx) => (
            <li
              key={`${item.description}-${idx}`}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-zinc-300">
                {formatDate(item.date)} — {item.description}
              </span>
              <span
                className={`font-medium ${item.type === "entrada" ? "text-emerald-400" : "text-red-400"}`}
              >
                {item.type === "entrada" ? "+" : "-"}
                {formatCurrency(item.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function InvestmentsList({
  investments,
}: {
  investments: FinancialSnapshot["investments"];
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
      <h2 className="mb-3 text-sm font-medium text-zinc-300">📈 Investimentos</h2>
      {investments.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhum investimento importado ainda.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {investments.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between text-sm">
              <span className="text-zinc-300">
                {inv.name}
                {inv.type ? <span className="text-zinc-500"> · {inv.type}</span> : null}
              </span>
              <span className="font-medium text-emerald-400">
                {formatCurrency(Number(inv.amount))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function GoalsProgress({
  goals,
}: {
  goals: FinancialSnapshot["goals"];
}) {
  if (goals.length === 0) return null;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
      <h2 className="mb-3 text-sm font-medium text-zinc-300">🎯 Metas</h2>
      <ul className="flex flex-col gap-3">
        {goals.map((g) => {
          const progress = Math.min(
            100,
            Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100),
          );
          return (
            <li key={g.id}>
              <div className="mb-1 flex items-center justify-between text-sm text-zinc-300">
                <span>{g.name}</span>
                <span>
                  {formatCurrency(Number(g.current_amount))} /{" "}
                  {formatCurrency(Number(g.target_amount))}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
