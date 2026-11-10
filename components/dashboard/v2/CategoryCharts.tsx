"use client";

import { useState } from "react";
import { categoryColor } from "@/lib/finance/categories";
import { niceMax, ribbonPath, roundedBarPath, sankeyLayout, squarify, topWithOthers, type FlowNode } from "@/lib/ui/chart-math";
import { INK, TipBox, money, moneyCompact, moneyShort, useChartWidth, useTip } from "./chart-kit";

const OTHER_COLOR = "#71717a";

/* ------------------------------------------------------------------ */
/** Gastos por categoria: anel com o total no meio + ranking com valor e %. */
export function CategoryDonut({ data, monthLabel }: { data: { category: string; total: number }[]; monthLabel: string }) {
  const [focus, setFocus] = useState<number | null>(null);
  const items = topWithOthers(
    data.map((d) => ({ name: d.category, value: d.total, color: categoryColor(d.category) })),
    5,
    (value) => ({ name: "Outros", value, color: OTHER_COLOR }),
  );
  const total = items.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return <p className="text-sm text-zinc-500">Nenhum gasto neste mês ainda.</p>;
  const S = 170, R = 80, r = 56;
  const starts = items.reduce<number[]>(
    (acc, item, i) => [...acc, i === 0 ? -Math.PI / 2 : acc[i - 1] + (items[i - 1].value / total) * Math.PI * 2],
    [],
  );
  const arcs = items.map((item, i) => {
    const a0 = starts[i];
    const a1 = a0 + (item.value / total) * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad: number, a: number) => `${S / 2 + rad * Math.cos(a)},${S / 2 + rad * Math.sin(a)}`;
    const d = items.length === 1
      ? `M${S / 2 - R},${S / 2} a${R},${R} 0 1,0 ${2 * R},0 a${R},${R} 0 1,0 ${-2 * R},0 M${S / 2 - r},${S / 2} a${r},${r} 0 1,1 ${2 * r},0 a${r},${r} 0 1,1 ${-2 * r},0`
      : `M${p(R, a0)} A${R},${R} 0 ${large} 1 ${p(R, a1)} L${p(r, a1)} A${r},${r} 0 ${large} 0 ${p(r, a0)} Z`;
    return d;
  });
  const center = focus === null ? { value: total, label: `gastos em ${monthLabel}` } : { value: items[focus].value, label: items[focus].name };

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[170px_minmax(0,1fr)]">
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} className="mx-auto block" role="img" aria-label={`Gastos por categoria: total ${money(total)}`}>
        {arcs.map((d, i) => (
          <path
            key={items[i].name}
            d={d}
            fill={items[i].color}
            fillRule="evenodd"
            fillOpacity={focus === null || focus === i ? 1 : 0.25}
            stroke={INK.surface}
            strokeWidth={2}
            onPointerEnter={() => setFocus(i)}
            onPointerDown={() => setFocus(i)}
            onPointerLeave={() => setFocus(null)}
          />
        ))}
        <text x={S / 2} y={S / 2 + 1} textAnchor="middle" fontSize={17} fontWeight={600} fill={INK.strong}>
          {moneyShort(center.value)}
        </text>
        <text x={S / 2} y={S / 2 + 17} textAnchor="middle" fontSize={10.5} fill={INK.text}>
          {center.label}
        </text>
      </svg>
      <ul className="flex flex-col gap-2.5">
        {items.map((item, i) => (
          <li
            key={item.name}
            className="grid grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-x-2 text-sm"
            onPointerEnter={() => setFocus(i)}
            onPointerLeave={() => setFocus(null)}
          >
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: item.color }} />
            <span className="truncate text-zinc-200">{item.name}</span>
            <span className="font-mono text-[11px] text-zinc-400">
              {moneyShort(item.value)} · {Math.round((item.value / total) * 100)}%
            </span>
            <span className="col-span-2 col-start-2 mt-1 block h-1 overflow-hidden rounded bg-zinc-800">
              <span className="block h-full rounded" style={{ width: `${(item.value / items[0].value) * 100}%`, background: item.color }} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/** Este mês x anterior: dois pontos por categoria ligados por uma linha. */
export function CompareDumbbell({
  data,
  currentLabel,
  previousLabel,
}: {
  data: { category: string; atual: number; anterior: number }[];
  currentLabel: string;
  previousLabel: string;
}) {
  const [ref, W] = useChartWidth<HTMLDivElement>();
  const { tip, show, hide } = useTip();
  const rows = data
    .filter((d) => d.atual > 0 || d.anterior > 0)
    .sort((a, b) => Math.max(b.atual, b.anterior) - Math.max(a.atual, a.anterior))
    .slice(0, 6);
  const H = 24 + rows.length * 36;
  const pad = { l: 100, r: 78, t: 18 };
  const max = niceMax(Math.max(1, ...rows.map((d) => Math.max(d.atual, d.anterior))));
  const x = (v: number) => pad.l + (v / max) * (W - pad.l - pad.r);
  if (rows.length === 0) return <p className="text-sm text-zinc-500">Sem gastos para comparar ainda.</p>;

  return (
    <div ref={ref} className="relative" style={{ minHeight: H }}>
      {W > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block touch-pan-y overflow-visible">
          {rows.map((d, i) => {
            const yy = pad.t + i * 36;
            const diff = d.atual - d.anterior;
            const tone = diff > 0.5 ? INK.bad : diff < -0.5 ? INK.goodSoft : INK.text;
            const color = categoryColor(d.category);
            return (
              <g key={d.category}>
                <text x={pad.l - 12} y={yy + 4} textAnchor="end" fontSize={11.5} fill={INK.strong}>
                  {d.category.length > 13 ? `${d.category.slice(0, 12)}…` : d.category}
                </text>
                <line x1={pad.l} x2={W - pad.r} y1={yy} y2={yy} stroke={INK.grid} />
                <line x1={x(d.anterior)} x2={x(d.atual)} y1={yy} y2={yy} stroke={color} strokeWidth={3} strokeLinecap="round" />
                <circle cx={x(d.anterior)} cy={yy} r={5} fill={INK.surface} stroke={INK.text} strokeWidth={2} />
                <circle cx={x(d.atual)} cy={yy} r={6} fill={color} stroke={INK.surface} strokeWidth={2} />
                <text x={W - pad.r + 10} y={yy + 4} fontSize={11} fontWeight={600} fill={tone}>
                  {Math.abs(diff) < 0.5 ? "igual" : `${diff > 0 ? "▲ +" : "▼ −"}${moneyShort(Math.abs(Math.round(diff)))}`}
                </text>
                <rect
                  x={0}
                  y={yy - 18}
                  width={W}
                  height={36}
                  fill="transparent"
                  onPointerMove={() => show(x(d.atual), yy, d.category, [`${previousLabel}: ${money(d.anterior)}`, `${currentLabel}: ${money(d.atual)}`])}
                  onPointerDown={() => show(x(d.atual), yy, d.category, [`${previousLabel}: ${money(d.anterior)}`, `${currentLabel}: ${money(d.atual)}`])}
                  onPointerLeave={hide}
                />
              </g>
            );
          })}
        </svg>
      )}
      <TipBox tip={tip} width={W} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function weekdayHeadline(data: { dia: string; total: number }[]): string {
  const total = data.reduce((s, d) => s + d.total, 0);
  if (total <= 0) return "Sem gastos neste mês ainda.";
  const top = data.reduce((best, d) => (d.total > best.total ? d : best), data[0]);
  const others = data.filter((d) => d !== top);
  const avg = others.reduce((s, d) => s + d.total, 0) / Math.max(1, others.length);
  const names: Record<string, string> = { Dom: "Domingo", Seg: "Segunda", Ter: "Terça", Qua: "Quarta", Qui: "Quinta", Sex: "Sexta", Sáb: "Sábado" };
  const ratio = avg > 0 ? top.total / avg : 0;
  return ratio >= 1.2
    ? `${names[top.dia] ?? top.dia} é o seu dia mais caro: ${ratio.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}× a média dos outros dias.`
    : "Seus gastos estão bem distribuídos ao longo da semana.";
}

/** Gastos por dia da semana, com o dia mais caro em destaque. */
export function WeekdayChart({ data }: { data: { dia: string; total: number }[] }) {
  const [ref, W] = useChartWidth<HTMLDivElement>();
  const { tip, show, hide } = useTip();
  const H = data.length * 28 + 6;
  const pad = { l: 38, r: 76 };
  const max = niceMax(Math.max(1, ...data.map((d) => d.total)));
  const top = data.reduce((best, d) => (d.total > best.total ? d : best), data[0] ?? { dia: "", total: 0 });

  return (
    <div ref={ref} className="relative" style={{ minHeight: H }}>
      {W > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block touch-pan-y overflow-visible">
          {data.map((d, i) => {
            const yy = 4 + i * 28;
            const w = (d.total / max) * (W - pad.l - pad.r);
            const isTop = d === top && d.total > 0;
            return (
              <g key={d.dia}>
                <text x={pad.l - 8} y={yy + 14} textAnchor="end" fontSize={11} fill={isTop ? INK.strong : INK.text}>
                  {d.dia}
                </text>
                <path d={roundedBarPath(pad.l, yy + 3, Math.max(2, w), 16, "right")} fill={isTop ? INK.goodSoft : INK.axis} />
                <text x={pad.l + Math.max(2, w) + 8} y={yy + 15} fontSize={11} fontWeight={isTop ? 600 : 400} fill={isTop ? INK.strong : INK.text}>
                  {moneyShort(Math.round(d.total))}
                </text>
                <rect
                  x={0}
                  y={yy}
                  width={W}
                  height={26}
                  fill="transparent"
                  onPointerMove={() => show(pad.l + w, yy, d.dia, [`${money(d.total)} no mês`])}
                  onPointerDown={() => show(pad.l + w, yy, d.dia, [`${money(d.total)} no mês`])}
                  onPointerLeave={hide}
                />
              </g>
            );
          })}
        </svg>
      )}
      <TipBox tip={tip} width={W} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/** Mix do patrimônio: mapa de blocos (área = valor) com nome e % dentro. */
export function AssetTreemap({ items }: { items: { name: string; value: number; color: string }[] }) {
  const [ref, W] = useChartWidth<HTMLDivElement>();
  const { tip, show, hide } = useTip();
  const H = 220;
  const total = items.reduce((s, d) => s + Math.max(0, d.value), 0);
  if (total <= 0) return <p className="text-sm text-zinc-500">Nada em contas ou investimentos ainda.</p>;
  const blocks = W > 0 ? squarify(items, { x: 0, y: 0, w: W, h: H }) : [];

  return (
    <div ref={ref} className="relative" style={{ minHeight: H }}>
      {W > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block touch-pan-y">
          {blocks.map((b) => {
            const pct = `${Math.round((b.value / total) * 100)}%`;
            const lines = [`${money(b.value)} · ${pct} do total`];
            return (
              <g
                key={b.name}
                onPointerMove={() => show(b.x + b.w / 2, b.y + 8, b.name, lines)}
                onPointerDown={() => show(b.x + b.w / 2, b.y + 8, b.name, lines)}
                onPointerLeave={hide}
              >
                <rect x={b.x + 1} y={b.y + 1} width={Math.max(0, b.w - 2)} height={Math.max(0, b.h - 2)} rx={8} fill={b.color} />
                {b.w > 96 && b.h > 46 ? (
                  <>
                    <text x={b.x + 10} y={b.y + 20} fontSize={12} fontWeight={600} fill="#fff">
                      {b.name.length > Math.floor(b.w / 8) ? `${b.name.slice(0, Math.floor(b.w / 8) - 1)}…` : b.name}
                    </text>
                    <text x={b.x + 10} y={b.y + 36} fontSize={11} fill="rgba(255,255,255,.85)">
                      {moneyCompact(b.value)} · {pct}
                    </text>
                  </>
                ) : b.w > 34 && b.h > 22 ? (
                  <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="#fff">
                    {pct}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      )}
      <TipBox tip={tip} width={W} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/** Fluxo do dinheiro do mês: entradas → mês → categorias e o que sobrou (ou faltou). */
export function MoneySankey({
  entradas,
  gastos,
}: {
  entradas: { name: string; value: number }[];
  gastos: { name: string; value: number }[];
}) {
  const [ref, W] = useChartWidth<HTMLDivElement>();
  const { tip, show, hide } = useTip();
  const [hover, setHover] = useState<string | null>(null);
  const inTotal = entradas.reduce((s, d) => s + d.value, 0);
  const outTotal = gastos.reduce((s, d) => s + d.value, 0);
  if (inTotal <= 0 && outTotal <= 0) return <p className="text-sm text-zinc-500">Sem movimentações neste mês ainda.</p>;

  const sources: FlowNode[] = topWithOthers(
    entradas.map((d) => ({ ...d, color: INK.good })),
    3,
    (value) => ({ name: "Outras entradas", value, color: INK.good }),
  );
  if (outTotal > inTotal) sources.push({ name: "Do saldo", value: Math.round((outTotal - inTotal) * 100) / 100, color: INK.bad });
  const targets: FlowNode[] = topWithOthers(
    gastos.map((d) => ({ ...d, color: categoryColor(d.name) })),
    5,
    (value) => ({ name: "Outros gastos", value, color: OTHER_COLOR }),
  );
  if (inTotal > outTotal) targets.push({ name: "Sobrou", value: Math.round((inTotal - outTotal) * 100) / 100, color: INK.goodSoft });

  const H = Math.max(240, 40 + Math.max(sources.length, targets.length) * 46);
  const narrow = W < 520;
  const labelL = narrow ? 84 : 110;
  const labelR = narrow ? 104 : 130;
  const xS = labelL, xT = W - labelR - 12, nw = 12;
  const xM = (xS + xT) / 2 - 6;
  const layout = sankeyLayout({ sources, targets, top: 28, height: H - 40, gap: 10 });
  const flowTotal = Math.max(inTotal, outTotal);

  // Onde cada faixa encosta na coluna do meio (empilhadas na ordem dos nós).
  const stackFrom = (nodes: { h: number }[]) =>
    nodes.reduce<number[]>((offsets, node, i) => [...offsets, i === 0 ? layout.mid.y : offsets[i - 1] + nodes[i - 1].h], []);
  const inOffsets = stackFrom(layout.sources);
  const outOffsets = stackFrom(layout.targets);
  const pct = (v: number) => `${Math.round((v / flowTotal) * 100)}%`;

  return (
    <div ref={ref} className="relative overflow-x-auto" style={{ minHeight: H }}>
      {W > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block touch-pan-y" role="img" aria-label={`Entrou ${money(inTotal)}, saiu ${money(outTotal)}`}>
          {layout.sources.map((s, i) => {
            const d = ribbonPath(xS + nw, s.y, s.y + s.h, xM, inOffsets[i], inOffsets[i] + s.h);
            const key = `in-${s.name}`;
            return (
              <path
                key={key}
                d={d}
                fill={s.color}
                fillOpacity={hover === null ? 0.32 : hover === key ? 0.85 : 0.1}
                onPointerMove={() => { setHover(key); show(xM - 40, s.y, s.name, [`${money(s.value)} · ${pct(s.value)}`]); }}
                onPointerDown={() => { setHover(key); show(xM - 40, s.y, s.name, [`${money(s.value)} · ${pct(s.value)}`]); }}
                onPointerLeave={() => { setHover(null); hide(); }}
              />
            );
          })}
          {layout.targets.map((t, i) => {
            const d = ribbonPath(xM + nw + 2, outOffsets[i], outOffsets[i] + t.h, xT, t.y, t.y + t.h);
            const key = `out-${t.name}`;
            return (
              <path
                key={key}
                d={d}
                fill={t.color}
                fillOpacity={hover === null ? 0.42 : hover === key ? 0.85 : 0.1}
                onPointerMove={() => { setHover(key); show(xM, t.y, t.name, [`${money(t.value)} · ${pct(t.value)} do que entrou`]); }}
                onPointerDown={() => { setHover(key); show(xM, t.y, t.name, [`${money(t.value)} · ${pct(t.value)} do que entrou`]); }}
                onPointerLeave={() => { setHover(null); hide(); }}
              />
            );
          })}
          {layout.sources.map((s) => (
            <g key={`ns-${s.name}`} pointerEvents="none">
              <rect x={xS} y={s.y} width={nw} height={Math.max(2, s.h)} rx={3} fill={s.color} />
              <text x={xS - 8} y={s.y + s.h / 2 - 2} textAnchor="end" fontSize={11.5} fontWeight={600} fill={INK.strong}>
                {s.name.length > 14 ? `${s.name.slice(0, 13)}…` : s.name}
              </text>
              <text x={xS - 8} y={s.y + s.h / 2 + 12} textAnchor="end" fontSize={10.5} fill={INK.text}>
                {moneyShort(Math.round(s.value))}
              </text>
            </g>
          ))}
          <rect x={xM} y={layout.mid.y} width={nw + 2} height={layout.mid.h} rx={3} fill={INK.strong} fillOpacity={0.85} pointerEvents="none" />
          <text x={xM + 7} y={layout.mid.y - 10} textAnchor="middle" fontSize={11.5} fontWeight={700} fill={INK.strong} pointerEvents="none">
            Entrou {moneyShort(Math.round(inTotal))}
          </text>
          {layout.targets.map((t) => (
            <g key={`nt-${t.name}`} pointerEvents="none">
              <rect x={xT} y={t.y} width={nw} height={Math.max(2, t.h)} rx={3} fill={t.color} />
              <text x={xT + nw + 8} y={t.y + t.h / 2 - 2} fontSize={11.5} fontWeight={t.name === "Sobrou" ? 700 : 500} fill={INK.strong}>
                {t.name.length > 14 ? `${t.name.slice(0, 13)}…` : t.name}
              </text>
              <text x={xT + nw + 8} y={t.y + t.h / 2 + 12} fontSize={10.5} fill={INK.text}>
                {moneyShort(Math.round(t.value))}
              </text>
            </g>
          ))}
        </svg>
      )}
      <TipBox tip={tip} width={W} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/** Calendário de calor do mês: quanto mais forte, mais você gastou no dia. */
export function SpendHeatmap({
  monthKey,
  todayKey,
  byDay,
}: {
  monthKey: string;
  todayKey: string;
  byDay: Record<string, number>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [year, month] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const keys = Array.from({ length: daysInMonth }, (_, i) => `${monthKey}-${String(i + 1).padStart(2, "0")}`);
  const values = keys.map((k) => byDay[k] ?? 0).filter((v) => v > 0).sort((a, b) => a - b);
  const q = (p: number) => values[Math.min(values.length - 1, Math.floor(p * values.length))] ?? 0;
  const cuts = [q(0.25), q(0.5), q(0.75), q(0.92)];
  const level = (v: number) => (v <= 0 ? 0 : v <= cuts[0] ? 1 : v <= cuts[1] ? 2 : v <= cuts[2] ? 3 : 4);
  const fills = [INK.track, "rgba(251,113,133,.22)", "rgba(251,113,133,.42)", "rgba(251,113,133,.68)", "#fb7185"];
  const weekdayNames = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const detail = selected ? `${weekdayNames[new Date(`${selected}T12:00:00`).getDay()]}, ${selected.slice(8, 10)}/${selected.slice(5, 7)} · ${money(byDay[selected] ?? 0)}` : null;
  const total = keys.reduce((s, k) => s + (byDay[k] ?? 0), 0);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] uppercase tracking-wide text-zinc-500" aria-hidden>
        {weekdayNames.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-1.5" role="grid" aria-label="Gastos por dia do mês">
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} aria-hidden />
        ))}
        {keys.map((key) => {
          const v = byDay[key] ?? 0;
          const lvl = level(v);
          const future = key > todayKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              onPointerEnter={() => setSelected(key)}
              aria-label={`${Number(key.slice(8, 10))}: ${money(v)}`}
              className={`relative aspect-square rounded-lg text-left font-mono text-[10px] focus-visible:outline-2 focus-visible:outline-emerald-400 ${future ? "opacity-40" : ""} ${key === todayKey ? "ring-2 ring-emerald-400/70" : ""}`}
              style={{ background: fills[lvl], color: lvl === 4 ? "#2a0a10" : undefined }}
            >
              <span className={`absolute left-1.5 top-1 ${lvl === 4 ? "" : "text-zinc-400"}`}>{Number(key.slice(8, 10))}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span className="text-zinc-300">{detail ?? "Toque num dia para ver quanto saiu."}</span>
        <span className="inline-flex items-center gap-1">
          menos
          {fills.map((fill) => (
            <span key={fill} className="inline-block h-3 w-3 rounded" style={{ background: fill }} />
          ))}
          mais · total {moneyShort(Math.round(total))}
        </span>
      </div>
    </div>
  );
}
