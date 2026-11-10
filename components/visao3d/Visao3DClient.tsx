"use client";

import { useMemo, useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { PageHero, PageShell, SectionLabel, SoftPanel, chipClass } from "@/components/ui/page-chrome";
import { formatCurrency } from "@/lib/finance/format";
import {
  MAX_GALAXY_POINTS,
  VISTAS_3D,
  balanceGrowthPercent,
  coinCount,
  monthName,
  monthTitle,
  pickCoinUnit,
  type BalanceMonth,
  type CategorySlice,
  type MonthSpending,
  type Vista3D,
} from "@/lib/finance/visao3d";
import Scene3D from "./Scene3D";
import type { SceneData } from "./scene-types";

const TABS: Record<Vista3D, { label: string; title: string; how: string; usesMonth: boolean }> = {
  cidade: {
    label: "Cidade",
    title: "Cidade do dinheiro",
    how: "Cada categoria é um prédio, e a altura é quanto você gastou no mês. Arraste para girar e toque num prédio.",
    usesMonth: true,
  },
  moedas: {
    label: "Moedas",
    title: "Moedas que caem",
    how: "As moedas se empilham por categoria: a pilha mais alta é para onde vai mais dinheiro. Arraste para girar e toque numa pilha.",
    usesMonth: true,
  },
  galaxia: {
    label: "Galáxia",
    title: "Galáxia dos gastos",
    how: "As entradas são o sol, cada categoria é um planeta e cada compra é uma estrela. Arraste para girar (também para cima e para baixo) e toque num planeta ou numa estrela.",
    usesMonth: true,
  },
  montanha: {
    label: "Montanha",
    title: "Montanha do saldo",
    how: "Cada faixa é um mês com o saldo em conta de cada dia. Arraste para girar e toque numa faixa para ver o mês.",
    usesMonth: false,
  },
  holograma: {
    label: "Holograma",
    title: "Holograma do seu dinheiro",
    how: "O saldo em conta flutua no feixe; cada anel é uma categoria, e o tamanho do arco é a % dos gastos. Arraste para girar.",
    usesMonth: true,
  },
};

const pct = (share: number) => `${Math.round(share * 100)}%`;
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const shortMoney = (value: number) => formatCurrency(value).replace(/,00$/, "");
const dayMonth = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
const categoryText = (categories: CategorySlice[]) =>
  categories.map((c) => `${c.name} ${formatCurrency(c.value)}`).join(", ");

function CategoryList({
  categories,
  extra,
}: {
  categories: CategorySlice[];
  extra?: (category: CategorySlice) => string;
}) {
  return (
    <ul className="divide-y divide-zinc-800/80">
      {categories.map((c) => (
        <li key={c.name} className="flex items-center gap-3 px-4 py-3">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-zinc-100">{c.name}</p>
            <p className="text-[11px] text-zinc-500">
              {plural(c.count, "gasto", "gastos")} · {pct(c.share)}
              {extra ? ` · ${extra(c)}` : ""}
            </p>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-800" aria-hidden>
              <div className="h-full rounded-full" style={{ width: `${Math.max(2, c.share * 100)}%`, background: c.color }} />
            </div>
          </div>
          <p className="shrink-0 text-sm font-medium tabular-nums text-zinc-100">{formatCurrency(c.value)}</p>
        </li>
      ))}
    </ul>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "good" }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <p className="text-sm text-zinc-300">{label}</p>
      <p className={`text-sm font-medium tabular-nums ${tone === "good" ? "text-emerald-300" : "text-zinc-100"}`}>{value}</p>
    </div>
  );
}

function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <SoftPanel className="p-6 text-center">
      <p className="text-sm font-medium text-zinc-200">{title}</p>
      {children ? <div className="mt-2 text-[13px] leading-relaxed text-zinc-500">{children}</div> : null}
    </SoftPanel>
  );
}

function MonthTable({ months }: { months: BalanceMonth[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Saldo em conta por mês: médio, maior e menor dia</caption>
        <thead className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">Mês</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Médio</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Maior</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Menor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/80 tabular-nums">
          {[...months].reverse().map((month) => (
            <tr key={month.monthKey}>
              <th scope="row" className="px-4 py-2.5 font-normal text-zinc-200">{month.label}</th>
              <td className="px-2 py-2.5 text-right text-zinc-100">{formatCurrency(month.avg)}</td>
              <td className="px-2 py-2.5 text-right text-zinc-400">
                {formatCurrency(month.max.balance)} <span className="text-[11px] text-zinc-500">dia {month.max.day}</span>
              </td>
              <td className="px-4 py-2.5 text-right text-zinc-400">
                {formatCurrency(month.min.balance)} <span className="text-[11px] text-zinc-500">dia {month.min.day}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Visao3DClient({
  initialVista,
  monthKey,
  months,
  spending,
  accountBalance,
  hasAccounts,
  balanceMonths,
  warnings,
}: {
  initialVista: Vista3D;
  monthKey: string;
  months: { key: string; label: string }[];
  spending: MonthSpending;
  accountBalance: number;
  hasAccounts: boolean;
  balanceMonths: BalanceMonth[];
  warnings: string[];
}) {
  const router = useRouter();
  const [vista, setVista] = useState<Vista3D>(initialVista);
  const [pending, startTransition] = useTransition();
  const tab = TABS[vista];
  const name = monthName(monthKey);
  const { categories, totalGastos, totalEntradas, points, pointsOmitted } = spending;
  const unit = pickCoinUnit(Math.max(0, ...categories.map((c) => c.value)));
  const hasSpending = categories.length > 0;

  const sceneData = useMemo<SceneData | null>(() => {
    switch (vista) {
      case "cidade":
        return hasSpending ? { kind: "cidade", monthName: name, categories, total: totalGastos } : null;
      case "moedas":
        return hasSpending ? { kind: "moedas", categories, unit } : null;
      case "galaxia":
        return hasSpending ? { kind: "galaxia", categories, points, entradas: totalEntradas } : null;
      case "montanha":
        return balanceMonths.length >= 2 ? { kind: "montanha", months: balanceMonths } : null;
      case "holograma":
        return hasSpending || hasAccounts ? { kind: "holograma", categories, accountBalance } : null;
    }
  }, [vista, hasSpending, hasAccounts, name, categories, totalGastos, unit, points, totalEntradas, balanceMonths, accountBalance]);

  const totalCoins = categories.reduce((sum, c) => sum + coinCount(c.value, unit), 0);
  const growth = balanceGrowthPercent(balanceMonths);
  const firstMonth = balanceMonths[0];
  const lastMonth = balanceMonths[balanceMonths.length - 1];
  const topPoints = useMemo(() => [...points].sort((a, b) => b.value - a.value).slice(0, 5), [points]);

  let idleDetail = "";
  let label = "";
  switch (vista) {
    case "cidade":
      idleDetail = `Gastos de ${name}: ${formatCurrency(totalGastos)} em ${plural(categories.length, "categoria", "categorias")}.`;
      label = `Cidade 3D dos gastos de ${name} por categoria: ${categoryText(categories)}.`;
      break;
    case "moedas":
      idleDetail = `Cada moeda = ${shortMoney(unit)} · ${plural(totalCoins, "moeda", "moedas")} ≈ ${formatCurrency(totalGastos)} gastos em ${name}.`;
      label = `Pilhas de moedas por categoria, cada moeda vale ${shortMoney(unit)}: ${categories
        .map((c) => `${c.name} ${plural(coinCount(c.value, unit), "moeda", "moedas")}`)
        .join(", ")}.`;
      break;
    case "galaxia":
      idleDetail = `${plural(categories.length, "planeta", "planetas")} · ${plural(points.length, "compra", "compras")} em ${name}${
        pointsOmitted > 0 ? ` (as ${MAX_GALAXY_POINTS} maiores de ${points.length + pointsOmitted})` : ""
      } · toque num planeta ou numa estrela.`;
      label = `Galáxia dos gastos de ${name}: entradas ${formatCurrency(totalEntradas)}; planetas: ${categoryText(categories)}.`;
      break;
    case "montanha":
      if (firstMonth && lastMonth) {
        const trend =
          growth === null ? "" : ` · o saldo médio ${growth >= 0 ? "subiu" : "caiu"} ${Math.abs(growth)}% no período`;
        idleDetail = `De ${firstMonth.label} a ${lastMonth.label}${trend} · toque numa faixa.`;
        label = `Saldo em conta diário de ${firstMonth.label} a ${lastMonth.label} em 3D, uma faixa por mês: ${balanceMonths
          .map((m) => `${m.label} média ${formatCurrency(m.avg)}`)
          .join(", ")}.`;
      }
      break;
    case "holograma":
      idleDetail = `Saldo em conta agora e gastos de ${name} por categoria.`;
      label = `Holograma do saldo em conta (${formatCurrency(accountBalance)}) e dos gastos de ${name} por categoria: ${
        categories.map((c) => `${c.name} ${pct(c.share)}`).join(", ") || "sem gastos"
      }.`;
      break;
  }

  function selectVista(next: Vista3D) {
    setVista(next);
    window.history.replaceState(null, "", `/3d?vista=${next}&mes=${monthKey}`);
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = VISTAS_3D[(index + (event.key === "ArrowRight" ? 1 : -1) + VISTAS_3D.length) % VISTAS_3D.length];
    selectVista(next);
    document.getElementById(`aba-3d-${next}`)?.focus();
  }

  function selectMonth(next: string) {
    startTransition(() => router.push(`/3d?vista=${vista}&mes=${next}`, { scroll: false }));
  }

  return (
    <PageShell>
      <PageHero
        kicker="Visão 3D"
        title={tab.usesMonth ? monthTitle(monthKey) : "Últimos 12 meses"}
        subtitle="Seus gastos e seu saldo em 3D. Os valores também ficam na lista abaixo de cada cena."
        trailing={
          tab.usesMonth ? (
            <label className="flex items-center gap-2">
              <span className="sr-only">Mês</span>
              <select
                value={monthKey}
                onChange={(event) => selectMonth(event.target.value)}
                disabled={pending}
                className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 disabled:opacity-60"
              >
                {months.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null
        }
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <SoftPanel className="p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Gastos de {name}</p>
            <p className="mt-1 text-xl font-semibold text-rose-300">{formatCurrency(totalGastos)}</p>
          </SoftPanel>
          <SoftPanel className="p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Entradas de {name}</p>
            <p className="mt-1 text-xl font-semibold text-emerald-300">{formatCurrency(totalEntradas)}</p>
          </SoftPanel>
          <SoftPanel className="col-span-2 p-4 lg:col-span-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Saldo em conta agora</p>
            <p className="mt-1 text-xl font-semibold text-white">{formatCurrency(accountBalance)}</p>
          </SoftPanel>
        </div>
      </PageHero>

      <div className={`mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-10 lg:px-6 ${pending ? "opacity-60" : ""}`}>
        {warnings.length ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="status">
            {warnings.join(" ")}
          </div>
        ) : null}

        <div role="tablist" aria-label="Cenas 3D" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {VISTAS_3D.map((id, index) => (
            <button
              key={id}
              id={`aba-3d-${id}`}
              type="button"
              role="tab"
              aria-selected={vista === id}
              aria-controls="painel-3d"
              tabIndex={vista === id ? 0 : -1}
              onClick={() => selectVista(id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              className={chipClass(vista === id)}
            >
              {TABS[id].label}
            </button>
          ))}
        </div>

        <section id="painel-3d" role="tabpanel" aria-labelledby={`aba-3d-${vista}`} className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{tab.title}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">{tab.how}</p>
          </div>

          {sceneData ? (
            <Scene3D key={`${vista}-${monthKey}`} data={sceneData} label={label} idleDetail={idleDetail} />
          ) : vista === "montanha" ? (
            <Empty title="A montanha ainda está crescendo">
              Ela precisa de pelo menos 2 meses de saldo guardado. O app guarda o saldo das suas contas todo dia, então a
              montanha vai enchendo sozinha com o tempo
              {balanceMonths.length === 1 ? ` (por enquanto há só ${balanceMonths[0].label})` : ""}.
            </Empty>
          ) : vista === "holograma" ? (
            <Empty title="Nada para projetar ainda">Conecte uma conta ou registre gastos para ver o holograma.</Empty>
          ) : (
            <Empty title={`Nenhum gasto em ${name}`}>Escolha outro mês no seletor lá em cima.</Empty>
          )}

          {vista === "montanha" ? (
            balanceMonths.length ? (
              <div>
                <SectionLabel>Saldo em conta por mês</SectionLabel>
                <SoftPanel>
                  <MonthTable months={balanceMonths} />
                </SoftPanel>
              </div>
            ) : null
          ) : (
            <>
              {vista === "galaxia" || vista === "holograma" ? (
                <SoftPanel className="divide-y divide-zinc-800/80">
                  {vista === "galaxia" ? <Row label={`Entradas de ${name} (o sol)`} value={formatCurrency(totalEntradas)} tone="good" /> : null}
                  {vista === "holograma" ? <Row label="Saldo em conta agora" value={formatCurrency(accountBalance)} tone="good" /> : null}
                  <Row label={`Gastos de ${name}`} value={formatCurrency(totalGastos)} />
                </SoftPanel>
              ) : null}

              {hasSpending ? (
                <div>
                  <SectionLabel>{vista === "moedas" ? `Cada moeda = ${shortMoney(unit)}` : `Gastos de ${name} por categoria`}</SectionLabel>
                  <SoftPanel>
                    <CategoryList
                      categories={categories}
                      extra={
                        vista === "moedas"
                          ? (c) => `≈ ${plural(coinCount(c.value, unit), "moeda", "moedas")}`
                          : undefined
                      }
                    />
                  </SoftPanel>
                </div>
              ) : null}

              {vista === "galaxia" && topPoints.length ? (
                <div>
                  <SectionLabel>Maiores compras (as estrelas mais brilhantes)</SectionLabel>
                  <SoftPanel>
                    <ul className="divide-y divide-zinc-800/80">
                      {topPoints.map((point) => (
                        <li key={point.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm text-zinc-100">{point.description}</p>
                            <p className="text-[11px] text-zinc-500">
                              {dayMonth(point.date)} · {point.category}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-medium tabular-nums text-zinc-100">{formatCurrency(point.value)}</p>
                        </li>
                      ))}
                    </ul>
                  </SoftPanel>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </PageShell>
  );
}
