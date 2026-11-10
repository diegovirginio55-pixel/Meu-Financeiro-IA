// Sem "use client": funções puras dos gráficos (servem no servidor, no cliente e nos testes).

/** Teto "redondo" do eixo: 1.300 → 1.500, 16.464 → 20.000, 5.600 → 6.000. */
export function niceMax(value: number): number {
  const v = Math.max(1, Math.abs(value));
  const power = Math.pow(10, Math.floor(Math.log10(v)));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * power >= v) ?? 10;
  return step * power;
}

/** Barra com só a ponta de dado arredondada (raio 4), presa à linha de base. */
export function roundedBarPath(x: number, y: number, w: number, h: number, end: "top" | "bottom" | "right"): string {
  const height = Math.max(0, h);
  const r = Math.min(4, w / 2, height);
  if (end === "top") {
    return `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + height} Z`;
  }
  if (end === "right") {
    return `M${x},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + height - r} Q${x + w},${y + height} ${x + w - r},${y + height} L${x},${y + height} Z`;
  }
  return `M${x},${y} L${x + w},${y} L${x + w},${y + height - r} Q${x + w},${y + height} ${x + w - r},${y + height} L${x + r},${y + height} Q${x},${y + height} ${x},${y + height - r} Z`;
}

/** Previsão do próximo ponto no ritmo dos últimos 3 (média das variações). */
export function forecastNext(values: number[]): number | null {
  if (values.length < 4) return null;
  const last = values[values.length - 1];
  const base = values[values.length - 4];
  return Math.round((last + (last - base) / 3) * 100) / 100;
}

export type Rect = { x: number; y: number; w: number; h: number };

/** Mapa de blocos (squarified): área de cada bloco proporcional ao valor. */
export function squarify<T extends { value: number }>(items: T[], rect: Rect): (T & Rect)[] {
  const positive = items.filter((item) => item.value > 0);
  const total = positive.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0 || rect.w <= 0 || rect.h <= 0) return [];
  const scale = (rect.w * rect.h) / total;
  let rest = positive
    .slice()
    .sort((a, b) => b.value - a.value)
    .map((item) => ({ item, area: item.value * scale }));
  let { x, y, w, h } = rect;
  const out: (T & Rect)[] = [];
  const worst = (row: { area: number }[], side: number) => {
    const sum = row.reduce((s, d) => s + d.area, 0);
    const max = Math.max(...row.map((d) => d.area));
    const min = Math.min(...row.map((d) => d.area));
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
  };
  while (rest.length > 0) {
    const side = Math.min(w, h);
    const row = [rest[0]];
    let i = 1;
    while (i < rest.length && worst([...row, rest[i]], side) <= worst(row, side)) {
      row.push(rest[i]);
      i += 1;
    }
    const sum = row.reduce((s, d) => s + d.area, 0);
    if (w >= h) {
      const cw = sum / h;
      let cy = y;
      for (const d of row) {
        const ch = d.area / cw;
        out.push({ ...d.item, x, y: cy, w: cw, h: ch });
        cy += ch;
      }
      x += cw;
      w -= cw;
    } else {
      const rh = sum / w;
      let cx = x;
      for (const d of row) {
        const cw = d.area / rh;
        out.push({ ...d.item, x: cx, y, w: cw, h: rh });
        cx += cw;
      }
      y += rh;
      h -= rh;
    }
    rest = rest.slice(i);
  }
  return out;
}

export type FlowNode = { name: string; value: number; color: string };
export type PlacedNode = FlowNode & { y: number; h: number };

/**
 * Fluxo do dinheiro (Sankey de 3 colunas): entradas → "o mês" → destinos.
 * Devolve as posições verticais de cada nó; a altura é proporcional ao valor.
 */
export function sankeyLayout({
  sources,
  targets,
  top,
  height,
  gap = 8,
}: {
  sources: FlowNode[];
  targets: FlowNode[];
  top: number;
  height: number;
  gap?: number;
}): { sources: PlacedNode[]; targets: PlacedNode[]; mid: { y: number; h: number }; scale: number } {
  const total = Math.max(
    sources.reduce((s, n) => s + n.value, 0),
    targets.reduce((s, n) => s + n.value, 0),
  );
  const maxCount = Math.max(sources.length, targets.length, 1);
  const scale = total > 0 ? (height - gap * (maxCount - 1)) / total : 0;
  const stack = (nodes: FlowNode[]) => {
    const used = nodes.reduce((s, n) => s + n.value * scale, 0) + gap * (nodes.length - 1);
    let y = top + (height - used) / 2;
    return nodes.map((node) => {
      const placed = { ...node, y, h: node.value * scale };
      y += placed.h + gap;
      return placed;
    });
  };
  const midH = total * scale;
  return { sources: stack(sources), targets: stack(targets), mid: { y: top + (height - midH) / 2, h: midH }, scale };
}

/** Caminho de uma faixa do Sankey entre dois trechos verticais. */
export function ribbonPath(x0: number, y0a: number, y0b: number, x1: number, y1a: number, y1b: number): string {
  const mx = (x0 + x1) / 2;
  return `M${x0},${y0a} C${mx},${y0a} ${mx},${y1a} ${x1},${y1a} L${x1},${y1b} C${mx},${y1b} ${mx},${y0b} ${x0},${y0b} Z`;
}

/** Até `limit` itens maiores; o resto vira um só ("Outros"). */
export function topWithOthers<T extends { value: number }>(items: T[], limit: number, makeOther: (value: number) => T): T[] {
  const sorted = items.filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length <= limit) return sorted;
  const rest = sorted.slice(limit).reduce((sum, item) => sum + item.value, 0);
  return [...sorted.slice(0, limit), makeOther(Math.round(rest * 100) / 100)];
}
