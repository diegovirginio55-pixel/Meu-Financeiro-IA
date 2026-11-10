import { describe, expect, it } from "vitest";
import { monthMood } from "../month-mood";

const base = { saldoConta: 1000, todayKey: "2026-11-15", perDay: 50 };

describe("cor do mês", () => {
  it("com orçamento: verde no ritmo, âmbar acima do ritmo, vermelho ao estourar", () => {
    // dia 15 de 30: o esperado é metade do limite
    expect(monthMood({ ...base, limit: 3000, spent: 1500 }).level).toBe("ok");
    expect(monthMood({ ...base, limit: 3000, spent: 1800 }).level).toBe("warn");
    expect(monthMood({ ...base, limit: 3000, spent: 3100 }).level).toBe("bad");
  });

  it("sem orçamento: usa quanto dá para gastar por dia", () => {
    expect(monthMood({ ...base, limit: null, spent: 0, perDay: 80 }).level).toBe("ok");
    expect(monthMood({ ...base, limit: null, spent: 0, perDay: 12 }).level).toBe("warn");
  });

  it("saldo negativo é sempre vermelho", () => {
    expect(monthMood({ ...base, saldoConta: -10, limit: 3000, spent: 0 }).level).toBe("bad");
  });
});
