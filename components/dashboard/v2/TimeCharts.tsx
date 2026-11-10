"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { forecastNext, niceMax, roundedBarPath } from "@/lib/ui/chart-math";
import { shiftMonthKey } from "@/lib/finance/fluxo";
import { INK, TipBox, money, moneyCompact, moneyShort, useChartWidth, useTip } from "./chart-kit";

const monthShort = (mes: string) => format(parseISO(`${mes}-01T12:00:00`), "MMM", { locale: ptBR }).replace(".", "");
const monthLong = (mes: string) => `${monthShort(mes)}/${mes.slice(2, 4)}`;

function yScale(lo: number, hi: number, top: number, bottom: number) {
  return (v: number) => top + ((hi - v) / (hi - lo || 1)) * (bottom - top);
}

/* ------------------------------------------------------------------ */
/** Evolução do patrimônio e do saldo em contas, com a previsão do próximo mês. */
export function PatrimonioChart({ data }: { data: { mes: string; saldo: number; patrimonio: number }[] }) {
  const [ref, W] = useChartWidth<HTMLDivElement>();
  const { tip, show, hide } = useTip();
  const H = 230;
  const forecast = forecastNext(data.map((d) => d.patrimonio));
  const n = data.length + (forecast !== null ? 1 : 0);
  const pad = { l: 58, r: forecast !== null ? 80 : 18, t: 22, b: 26 };
  const all = [...data.map((d) => d.patrimonio), ...data.map((d) => d.saldo), forecast ?? 0, 0];
  const hi = niceMax(Math.max(...all));
  const lo = Math.min(...all) < 0 ? -niceMax(-Math.min(...all)) : 0;
  const y = yScale(lo, hi, pad.t, H - pad.b);
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, n - 1);
  const last = data.length - 1;
  const linePat = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.patrimonio)}`).join(" ");
  const lineSaldo = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.saldo)}`).join(" ");
  const every = W < 480 ? 3 : 2;
  const nextMes = data.length ? shiftMonthKey(data[last].mes, 1) : "";

  function onMove(clientX: number, box: DOMRect) {
    const i = Math.max(0, Math.min(n - 1, Math.round(((clientX - box.left - pad.l) / (W - pad.l - pad.r)) * (n - 1))));
    if (i > last) {
      show(x(i), y(forecast ?? 0), `${monthLong(nextMes)} · previsão`, [`Patrimônio ${money(forecast ?? 0)}`, "no ritmo dos últimos 3 meses"]);
      return;
    }
    show(x(i), y(data[i].patrimonio), monthLong(data[i].mes), [`Patrimônio ${money(data[i].patrimonio)}`, `Saldo em contas ${money(data[i].saldo)}`]);
  }

  return (
    <div ref={ref} className="relative" style={{ minHeight: H }}>
      {W > 0 && data.length > 1 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block touch-pan-y overflow-visible">
          <defs>
            <linearGradient id="v2-pat" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={INK.good} stopOpacity="0.3" />
              <stop offset="100%" stopColor={INK.good} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[hi, hi / 2, 0, ...(lo < 0 ? [lo] : [])].map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? INK.axis : INK.grid} />
              <text x={pad.l - 8} y={y(t) + 3} textAnchor="end" fontSize={10.5} fill={INK.text}>
                {t === 0 ? "R$ 0" : moneyCompact(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) =>
            i % every === 0 || i === last ? (
              <text key={d.mes} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10.5} fill={INK.text}>
                {monthShort(d.mes)}
              </text>
            ) : null,
          )}
          <path d={`${linePat} L${x(last)},${y(Math.max(lo, 0))} L${x(0)},${y(Math.max(lo, 0))} Z`} fill="url(#v2-pat)" />
          <path d={lineSaldo} fill="none" stroke={INK.blue} strokeWidth={1.5} strokeOpacity={0.9} strokeLinejoin="round" />
          <path d={linePat} pathLength={1} className="chart-draw" fill="none" stroke={INK.good} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {forecast !== null && (
            <g>
              <path d={`M${x(last)},${y(data[last].patrimonio)} L${x(last + 1)},${y(forecast)}`} stroke={INK.text} strokeWidth={2} strokeDasharray="4 4" fill="none" />
              <circle cx={x(last + 1)} cy={y(forecast)} r={4} fill={INK.surface} stroke={INK.text} strokeWidth={2} />
              <text x={x(last + 1) + 9} y={y(forecast) - 2} fontSize={10.5} fontWeight={600} fill={INK.strong}>
                {moneyCompact(forecast)}
              </text>
              <text x={x(last + 1) + 9} y={y(forecast) + 12} fontSize={10.5} fill={INK.text}>
                previsão {monthShort(nextMes)}
              </text>
            </g>
          )}
          <circle cx={x(last)} cy={y(data[last].patrimonio)} r={5} fill={INK.good} stroke={INK.surface} strokeWidth={2} />
          <text x={x(last) - 8} y={y(data[last].patrimonio) - 12} textAnchor="end" fontSize={10.5} fontWeight={600} fill={INK.strong}>
            {moneyCompact(data[last].patrimonio)}
          </text>
          {tip && <line x1={tip.x} x2={tip.x} y1={pad.t} y2={H - pad.b} stroke={INK.axis} />}
          <rect
            x={pad.l - 10}
            y={0}
            width={W - pad.l - pad.r + 40}
            height={H}
            fill="transparent"
            onPointerMove={(e) => onMove(e.clientX, e.currentTarget.ownerSVGElement!.getBoundingClientRect())}
            onPointerDown={(e) => onMove(e.clientX, e.currentTarget.ownerSVGElement!.getBoundingClientRect())}
            onPointerLeave={hide}
          />
        </svg>
      )}
      <TipBox tip={tip} width={W} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/** Entradas para cima, despesas para baixo e o resultado do mês como ponto (mesma escala). */
export function FlowDivergingChart({ data }: { data: { mes: string; entradas: number; despesas: number }[] }) {
  const [ref, W] = useChartWidth<HTMLDivElement>();
  const { tip, show, hide } = useTip();
  const H = 250;
  const pad = { l: 58, r: 12, t: 14, b: 26 };
  const max = niceMax(Math.max(1, ...data.map((d) => Math.max(d.entradas, d.despesas))));
  const half = (H - pad.t - pad.b) / 2;
  const mid = pad.t + half;
  const yv = (v: number) => mid - (v / max) * half;
  const band = (W - pad.l - pad.r) / Math.max(1, data.length);
  const bw = Math.min(22, band * 0.52);
  const nets = data.map((d) => d.entradas - d.despesas);

  return (
    <div ref={ref} className="relative" style={{ minHeight: H }}>
      {W > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block touch-pan-y overflow-visible">
          {[max, max / 2, 0, -max / 2, -max].map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={yv(t)} y2={yv(t)} stroke={t === 0 ? INK.axis : INK.grid} />
              <text x={pad.l - 8} y={yv(t) + 3} textAnchor="end" fontSize={10.5} fill={INK.text}>
                {t === 0 ? "0" : `${t > 0 ? "+" : "−"}${moneyCompact(Math.abs(t))}`}
              </text>
            </g>
          ))}
          <path
            d={nets.map((v, i) => `${i ? "L" : "M"}${pad.l + band * (i + 0.5)},${yv(v)}`).join(" ")}
            fill="none"
            stroke={INK.strong}
            strokeOpacity={0.35}
            strokeWidth={1.5}
          />
          {data.map((d, i) => {
            const cx = pad.l + band * (i + 0.5);
            const up = (d.entradas / max) * half;
            const down = (d.despesas / max) * half;
            return (
              <g key={d.mes}>
                <path d={roundedBarPath(cx - bw / 2, mid - up, bw, up - 1, "top")} fill={INK.good} />
                <path d={roundedBarPath(cx - bw / 2, mid + 1, bw, down - 1, "bottom")} fill={INK.bad} fillOpacity={0.9} />
                <circle cx={cx} cy={yv(nets[i])} r={4} fill={INK.strong} stroke={INK.surface} strokeWidth={2} />
                {(W >= 480 || i % 2 === 0) && (
                  <text x={cx} y={H - 8} textAnchor="middle" fontSize={10.5} fill={INK.text}>
                    {monthShort(d.mes)}
                  </text>
                )}
                <rect
                  x={cx - band / 2}
                  y={pad.t}
                  width={band}
                  height={H - pad.t - pad.b}
                  fill="transparent"
                  onPointerMove={() => show(cx, mid - up, monthLong(d.mes), [`Entradas ${money(d.entradas)}`, `Despesas ${money(d.despesas)}`, `Resultado ${nets[i] >= 0 ? "+" : "−"}${money(Math.abs(nets[i]))}`])}
                  onPointerDown={() => show(cx, mid - up, monthLong(d.mes), [`Entradas ${money(d.entradas)}`, `Despesas ${money(d.despesas)}`, `Resultado ${nets[i] >= 0 ? "+" : "−"}${money(Math.abs(nets[i]))}`])}
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
export function savingsHeadline(data: { entradas: number; despesas: number }[], meta: number | null): string {
  const values = data.map((d) => d.entradas - d.despesas);
  const red = values.filter((v) => v < 0).length;
  if (meta && meta > 0) {
    const hits = values.filter((v) => v >= meta).length;
    return `${hits} de ${values.length} meses bateram a meta de ${moneyShort(meta)} · ${red} ${red === 1 ? "mês" : "meses"} no vermelho.`;
  }
  const positive = values.filter((v) => v > 0);
  const avg = positive.length ? positive.reduce((s, v) => s + v, 0) / positive.length : 0;
  return `Você guardou em ${positive.length} de ${values.length} meses (média ${moneyShort(Math.round(avg))}) · ${red} ${red === 1 ? "mês" : "meses"} no vermelho.`;
}

/** Quanto sobrou em cada mês, com a linha da meta de economia. */
export function SavingsChart({ data, meta }: { data: { mes: string; entradas: number; despesas: number }[]; meta: number | null }) {
  const [ref, W] = useChartWidth<HTMLDivElement>();
  const { tip, show, hide } = useTip();
  const H = 200;
  const pad = { l: 52, r: 12, t: 16, b: 24 };
  const values = data.map((d) => d.entradas - d.despesas);
  const hi = niceMax(Math.max(1, ...values, meta ?? 0));
  const lo = Math.min(0, ...values) < 0 ? -niceMax(-Math.min(...values)) : 0;
  const y = yScale(lo, hi, pad.t, H - pad.b);
  const band = (W - pad.l - pad.r) / Math.max(1, data.length);
  const bw = Math.min(20, band * 0.58);

  return (
    <div ref={ref} className="relative" style={{ minHeight: H }}>
      {W > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block touch-pan-y overflow-visible">
          {[hi, 0, ...(lo < 0 ? [lo] : [])].map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? INK.axis : INK.grid} />
              <text x={pad.l - 8} y={y(t) + 3} textAnchor="end" fontSize={10.5} fill={INK.text}>
                {t === 0 ? "0" : `${t < 0 ? "−" : ""}${moneyCompact(Math.abs(t))}`}
              </text>
            </g>
          ))}
          {values.map((v, i) => {
            const cx = pad.l + band * (i + 0.5);
            const hit = meta !== null && v >= meta;
            const label = [`${v >= 0 ? "Guardou" : "Faltou"} ${money(Math.abs(v))}`, ...(hit ? ["bateu a meta ✓"] : [])];
            return (
              <g key={data[i].mes}>
                {v >= 0 ? (
                  <path d={roundedBarPath(cx - bw / 2, y(v), bw, y(0) - y(v) - 1, "top")} fill={INK.good} fillOpacity={meta === null || hit ? 1 : 0.5} />
                ) : (
                  <path d={roundedBarPath(cx - bw / 2, y(0) + 1, bw, y(v) - y(0) - 1, "bottom")} fill={INK.bad} />
                )}
                {(W >= 480 || i % 2 === 0) && (
                  <text x={cx} y={H - 8} textAnchor="middle" fontSize={10.5} fill={INK.text}>
                    {monthShort(data[i].mes)}
                  </text>
                )}
                <rect
                  x={cx - band / 2}
                  y={pad.t}
                  width={band}
                  height={H - pad.t - pad.b}
                  fill="transparent"
                  onPointerMove={() => show(cx, y(Math.max(0, v)), monthLong(data[i].mes), label)}
                  onPointerDown={() => show(cx, y(Math.max(0, v)), monthLong(data[i].mes), label)}
                  onPointerLeave={hide}
                />
              </g>
            );
          })}
          {meta !== null && meta > 0 && (
            <g pointerEvents="none">
              <line x1={pad.l} x2={W - pad.r} y1={y(meta)} y2={y(meta)} stroke={INK.strong} strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray="5 4" />
              <text x={W - pad.r} y={y(meta) - 6} textAnchor="end" fontSize={10.5} fontWeight={600} fill={INK.strong}>
                meta {moneyShort(meta)}
              </text>
            </g>
          )}
        </svg>
      )}
      <TipBox tip={tip} width={W} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/** Saídas por dia (30 dias) com fins de semana marcados, entradas sinalizadas e o maior gasto escrito. */
export function DailyChart({ data }: { data: { key: string; dia: string; entradas: number; despesas: number }[] }) {
  const [ref, W] = useChartWidth<HTMLDivElement>();
  const { tip, show, hide } = useTip();
  const H = 210;
  const pad = { l: 50, r: 12, t: 34, b: 24 };
  const max = niceMax(Math.max(1, ...data.map((d) => d.despesas)));
  const y = yScale(0, max, pad.t, H - pad.b);
  const band = (W - pad.l - pad.r) / Math.max(1, data.length);
  const bw = Math.max(3, Math.min(14, band * 0.62));
  const top = data.reduce((best, d) => (d.despesas > best.despesas ? d : best), data[0] ?? { despesas: 0 });
  const bigIncome = data.reduce((best, d) => (d.entradas > best.entradas ? d : best), data[0] ?? { entradas: 0 });
  const weekday = (key: string) => parseISO(`${key}T12:00:00`).getDay();

  return (
    <div ref={ref} className="relative" style={{ minHeight: H }}>
      {W > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block touch-pan-y overflow-visible">
          {data.map((d, i) =>
            weekday(d.key) === 0 || weekday(d.key) === 6 ? (
              <rect key={`we-${d.key}`} x={pad.l + band * i} y={pad.t - 6} width={band} height={H - pad.t - pad.b + 6} rx={2} fill={INK.track} fillOpacity={0.55} />
            ) : null,
          )}
          {[0, max / 2, max].map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? INK.axis : INK.grid} />
              <text x={pad.l - 8} y={y(t) + 3} textAnchor="end" fontSize={10.5} fill={INK.text}>
                {moneyShort(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = pad.l + band * (i + 0.5);
            const lines = [`Saídas ${money(d.despesas)}`, ...(d.entradas > 0 ? [`Entradas ${money(d.entradas)}`] : [])];
            return (
              <g key={d.key}>
                {d.despesas > 0 && (
                  <path d={roundedBarPath(cx - bw / 2, y(d.despesas), bw, y(0) - y(d.despesas), "top")} fill={INK.bad} fillOpacity={d === top ? 1 : 0.72} />
                )}
                {d.entradas > 0 && (
                  <g pointerEvents="none">
                    <line x1={cx} x2={cx} y1={10} y2={y(0)} stroke={INK.good} strokeWidth={2} strokeDasharray="2 3" />
                    <circle cx={cx} cy={10} r={4} fill={INK.good} />
                    {d === bigIncome && (
                      <text x={cx > W - 140 ? cx - 7 : cx + 7} y={14} textAnchor={cx > W - 140 ? "end" : "start"} fontSize={10.5} fontWeight={600} fill={INK.strong}>
                        +{moneyShort(d.entradas)} em {d.dia}
                      </text>
                    )}
                  </g>
                )}
                {d === top && d.despesas > 0 && (
                  <text x={cx > W - 110 ? cx - bw / 2 - 4 : cx + bw / 2 + 4} y={y(d.despesas) + 4} textAnchor={cx > W - 110 ? "end" : "start"} fontSize={10.5} fontWeight={600} fill={INK.strong}>
                    {moneyShort(d.despesas)}
                  </text>
                )}
                {i % (W < 480 ? 7 : 4) === 0 && (
                  <text x={cx} y={H - 8} textAnchor="middle" fontSize={10.5} fill={INK.text}>
                    {d.dia}
                  </text>
                )}
                <rect
                  x={cx - band / 2}
                  y={0}
                  width={band}
                  height={H}
                  fill="transparent"
                  onPointerMove={() => show(cx, y(d.despesas), d.dia, lines)}
                  onPointerDown={() => show(cx, y(d.despesas), d.dia, lines)}
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
