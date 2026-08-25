export const chartTooltipStyle = {
  background: "var(--chart-tooltip-bg)",
  border: "1px solid var(--chart-tooltip-border)",
  borderRadius: 16,
  fontSize: 12,
  color: "var(--chart-tooltip-fg)",
  boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
  padding: "10px 12px",
};

export function compactAxis(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `R$ ${(value / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

export function compactShort(value: number): string {
  const abs = Math.abs(value);
  if (abs < 1) return "";
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `${(value / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

export function barMoneyLabel(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) < 0.005) return "";
  if (Math.abs(n) >= 1_000) return compactShort(n);
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export function barPercentLabel(value: unknown, digits = 2): string {
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) < 0.0005) return "";
  return `${n.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}
