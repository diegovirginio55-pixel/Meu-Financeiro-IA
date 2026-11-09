import { describe, expect, it } from "vitest";
import { formatBRLInput, parseBRL } from "../money";
import { calendarDaysAgoSP, formatDateSP, formatTimeSP, saoPauloDayKey } from "../datetime";

describe("parseBRL", () => {
  it.each([
    ["1500", 1500],
    ["1.500", 1500],
    ["1.500,50", 1500.5],
    ["1500,5", 1500.5],
    ["R$ 1.500,00", 1500],
    ["R$ 1.234,56", 1234.56],
    ["12.5", 12.5],
    ["12.50", 12.5],
    ["1.000.000", 1000000],
    ["1.500.000,99", 1500000.99],
    ["0,5", 0.5],
    ["-150,00", -150],
  ])("%s → %d", (input, expected) => {
    expect(parseBRL(input)).toBe(expected);
  });

  it.each(["", "   ", "abc", "1.5000", "1,500.50", "R$", "1500."])("rejeita %j", (input) => {
    expect(parseBRL(input)).toBeNull();
  });

  it("volta do formato de exibição", () => {
    expect(formatBRLInput(1500)).toBe("1.500,00");
    expect(parseBRL(formatBRLInput(98765.43))).toBe(98765.43);
    expect(formatBRLInput(null)).toBe("");
  });
});

describe("datas no fuso de São Paulo", () => {
  // 02:30 UTC de 09/11 = 23:30 de 08/11 em São Paulo.
  const now = new Date("2026-11-09T02:30:00Z");

  it("usa o dia e a hora de São Paulo mesmo com o servidor em UTC", () => {
    expect(saoPauloDayKey(now)).toBe("2026-11-08");
    expect(formatTimeSP(now)).toBe("23:30");
    expect(formatDateSP(now)).toBe("08/11/2026");
  });

  it("conta dias de calendário em São Paulo", () => {
    expect(calendarDaysAgoSP(new Date("2026-11-08T12:00:00Z"), now)).toBe(0);
    expect(calendarDaysAgoSP(new Date("2026-11-07T12:00:00Z"), now)).toBe(1);
  });
});
