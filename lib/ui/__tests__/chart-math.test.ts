import { describe, expect, it } from "vitest";
import { forecastNext, niceMax, sankeyLayout, squarify, topWithOthers } from "../chart-math";

describe("contas dos gráficos", () => {
  it("teto redondo do eixo", () => {
    expect(niceMax(1300)).toBe(1500);
    expect(niceMax(16464)).toBe(20000);
    expect(niceMax(5600)).toBe(6000);
    expect(niceMax(0)).toBe(1);
  });

  it("previsão no ritmo dos últimos 3 meses", () => {
    expect(forecastNext([100, 200, 300, 400])).toBe(500);
    expect(forecastNext([1, 2])).toBeNull();
  });

  it("mapa de blocos ocupa a área toda, proporcional aos valores", () => {
    const blocks = squarify([{ value: 50 }, { value: 30 }, { value: 20 }, { value: 0 }], { x: 0, y: 0, w: 100, h: 50 });
    expect(blocks).toHaveLength(3);
    const area = blocks.reduce((s, b) => s + b.w * b.h, 0);
    expect(area).toBeCloseTo(5000, 5);
    expect(blocks[0].w * blocks[0].h).toBeCloseTo(2500, 5);
  });

  it("Sankey: alturas proporcionais e entradas e destinos com a mesma escala", () => {
    const layout = sankeyLayout({
      sources: [{ name: "Salário", value: 4000, color: "" }, { name: "Freela", value: 1000, color: "" }],
      targets: [{ name: "Moradia", value: 3000, color: "" }, { name: "Sobrou", value: 2000, color: "" }],
      top: 0,
      height: 216,
      gap: 8,
    });
    expect(layout.sources[0].h / layout.sources[1].h).toBeCloseTo(4, 5);
    expect(layout.mid.h).toBeCloseTo(5000 * layout.scale, 5);
    expect(layout.targets[1].y).toBeGreaterThan(layout.targets[0].y + layout.targets[0].h);
  });

  it("junta o que passa do limite em Outros", () => {
    const items = [5, 4, 3, 2, 1].map((value, i) => ({ name: `c${i}`, value }));
    const result = topWithOthers(items, 3, (value) => ({ name: "Outros", value }));
    expect(result.map((r) => r.name)).toEqual(["c0", "c1", "c2", "Outros"]);
    expect(result[3].value).toBe(3);
  });
});
