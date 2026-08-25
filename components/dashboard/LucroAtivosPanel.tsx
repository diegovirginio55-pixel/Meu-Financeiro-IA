"use client";

import { useMemo, useState } from "react";
import { formatCurrency, formatPercent } from "@/lib/finance/format";
import type { BankConnection, Investment, InvestmentSnapshot, InvestmentTxn } from "@/lib/finance/types";
import {
  buildDailyInvestmentPnl,
  buildDailyInvestmentPnlByAsset,
  buildDailyYieldSeries,
  buildMonthlyInvestmentYield,
  periodYield,
  summarizeAssetPnl,
  totalAccumulatedProfit,
} from "@/lib/finance/investment-pnl";
import { withAccruedYield } from "@/lib/finance/investment-yield";
import { LucroDiarioChart } from "@/components/ativos/LucroDiarioChart";
import {
  LucroAtivosBarChart,
  RendimentoDiarioChart,
  RendimentoMensalChart,
} from "@/components/dashboard/ExtraCharts";

type ChartMode = "juntos" | "bancos" | "ativos";
type ChartVariant = "bar" | "line";

export function LucroAtivosPanel({
  connections,
  investments,
  snapshots,
  investmentTx,
}: {
  connections: BankConnection[];
  investments: Investment[];
  snapshots: InvestmentSnapshot[];
  investmentTx: InvestmentTxn[];
}) {
  const [mode, setMode] = useState<ChartMode>("ativos");
  const [variant, setVariant] = useState<ChartVariant>("bar");

  const liveInvestments = useMemo(
    () => withAccruedYield(investments, snapshots, investmentTx),
    [investments, snapshots, investmentTx],
  );

  const byBank = useMemo(
    () =>
      buildDailyInvestmentPnl({
        connections,
        investments: liveInvestments,
        snapshots,
        transactions: investmentTx,
      }),
    [connections, liveInvestments, snapshots, investmentTx],
  );

  const byAsset = useMemo(
    () =>
      buildDailyInvestmentPnlByAsset({
        investments: liveInvestments,
        snapshots,
        transactions: investmentTx,
      }),
    [liveInvestments, snapshots, investmentTx],
  );

  const rows = useMemo(
    () => summarizeAssetPnl(byAsset.series, byAsset.keys, liveInvestments, byAsset.estimatedIds),
    [byAsset, liveInvestments],
  );

  const dailyYield = useMemo(
    () => buildDailyYieldSeries(byAsset.series, liveInvestments, snapshots),
    [byAsset.series, liveInvestments, snapshots],
  );

  const monthlyYield = useMemo(
    () =>
      buildMonthlyInvestmentYield({
        investments: liveInvestments,
        snapshots,
        transactions: investmentTx,
      }),
    [liveInvestments, snapshots, investmentTx],
  );

  const lucroAcumulado = totalAccumulatedProfit(liveInvestments);
  const lucroPeriodoRaw = byAsset.series.reduce((sum, point) => sum + Number(point.Total), 0);
  const lucroPeriodo = Math.abs(lucroPeriodoRaw) >= 0.005 ? lucroPeriodoRaw : lucroAcumulado;
  const lucroHojeRaw = Number(byAsset.series[byAsset.series.length - 1]?.Total ?? 0);
  const lucroHoje = Math.abs(lucroHojeRaw) >= 0.005 ? lucroHojeRaw : 0;
  const estimated = mode === "bancos" ? byBank.estimated : byAsset.estimated;
  const visibleKeys = rows.slice(0, 12).map((row) => ({ key: row.key, label: row.label }));
  const rendimentoHoje = dailyYield[dailyYield.length - 1]?.rendimento ?? 0;
  const rendimento30d = periodYield(dailyYield);
  const lucroDia = dailyYield[dailyYield.length - 1]?.lucro ?? lucroHoje;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 lg:rounded-3xl lg:p-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 p-3 lg:p-4">
          <h3 className="text-sm font-medium text-zinc-200">Rendimento diário</h3>
          <p className="mt-1 text-[11px] text-zinc-500">Lucro do dia dividido pelo patrimônio investido.</p>
          <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-950/50 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Hoje</p>
            <p className={`mt-1 text-2xl font-semibold ${lucroDia >= 0 ? "text-emerald-400" : "text-rose-300"}`}>
              {formatCurrency(lucroDia)}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">{formatPercent(rendimentoHoje, 3)}</p>
          </div>
          <div className="mt-3">
            <RendimentoDiarioChart data={dailyYield} />
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 p-3 lg:p-4">
          <h3 className="text-sm font-medium text-zinc-200">Rendimento mensal</h3>
          <p className="mt-1 text-[11px] text-zinc-500">Lucro do mês sobre o saldo médio investido.</p>
          <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-950/50 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">30 dias</p>
            <p className={`mt-1 text-2xl font-semibold ${lucroPeriodo >= 0 ? "text-emerald-400" : "text-rose-300"}`}>
              {formatCurrency(lucroPeriodo)}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">{formatPercent(rendimento30d)}</p>
          </div>
          <div className="mt-3">
            <RendimentoMensalChart data={monthlyYield.series} />
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Lucro diário dos investimentos</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Cada ativo, cada banco e o total dos últimos 30 dias.
            {estimated
              ? " Sem histórico diário da Pluggy, o app estima o lucro com a taxa do último mês ou com o valor atual menos o valor aplicado."
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <div className="flex rounded-full bg-zinc-900 p-0.5 text-[11px]">
            {(
              [
                ["bar", "Barras"],
                ["line", "Linha"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setVariant(value)}
                className={`rounded-full px-2.5 py-1 ${variant === value ? "bg-zinc-700 text-white" : "text-zinc-400"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex rounded-full bg-zinc-900 p-0.5 text-[11px]">
            {(
              [
                ["juntos", "Total"],
                ["bancos", "Por banco"],
                ["ativos", "Por investimento"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded-full px-2.5 py-1 ${mode === value ? "bg-emerald-600 text-white" : "text-zinc-400"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Kpi label="Hoje" value={lucroHoje} />
        <Kpi label="30 dias" value={lucroPeriodo} />
        <Kpi label="Acumulado" value={lucroAcumulado} />
      </div>

      <div className="mt-4">
        {mode === "juntos" && (
          <LucroDiarioChart data={byAsset.series} series={[]} mode="juntos" variant={variant} />
        )}
        {mode === "bancos" && (
          <LucroDiarioChart data={byBank.series} banks={byBank.banks} mode="ambos" variant={variant} />
        )}
        {mode === "ativos" && (
          <LucroDiarioChart
            data={byAsset.series}
            series={visibleKeys}
            mode="separados"
            height={320}
            variant={variant}
          />
        )}
      </div>

      {byAsset.keys.length > 12 && mode === "ativos" && (
        <p className="mt-2 text-xs text-zinc-500">
          O gráfico mostra os 12 primeiros; a tabela abaixo tem todos os {byAsset.keys.length} investimentos.
        </p>
      )}

      <div className="mt-5">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
          Lucro de cada investimento
        </h3>
        <LucroAtivosBarChart rows={rows} />
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="pb-2 font-medium">Investimento</th>
              <th className="pb-2 text-right font-medium">Hoje</th>
              <th className="pb-2 text-right font-medium">7 dias</th>
              <th className="pb-2 text-right font-medium">30 dias</th>
              <th className="pb-2 text-right font-medium">Acumulado</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-zinc-500">
                  Nenhum investimento para calcular o lucro diário.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key} className="border-t border-zinc-800/80">
                  <td className="py-2.5 pr-3">
                    <p className="text-zinc-100">{row.label}</p>
                    <p className="text-[11px] text-zinc-500">
                      {formatCurrency(row.amount)}
                      {row.rate != null && Number(row.rate) !== 0 ? ` · ${row.rate.toFixed(2)}% no mês` : ""}
                      {row.estimated ? " · estimado" : ""}
                    </p>
                  </td>
                  <MoneyCell value={row.today} />
                  <MoneyCell value={row.d7} />
                  <MoneyCell value={row.d30} />
                  <MoneyCell value={row.accumulated} />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 truncate text-sm font-semibold sm:text-lg ${value >= 0 ? "text-emerald-400" : "text-rose-300"}`}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function MoneyCell({ value }: { value: number }) {
  return (
    <td className={`py-2.5 text-right ${value >= 0 ? "text-emerald-400" : "text-red-400"}`}>
      {formatCurrency(value)}
    </td>
  );
}
