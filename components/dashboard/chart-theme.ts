export const chartTooltipStyle = {
  background: "rgba(9, 9, 11, 0.96)",
  border: "1px solid rgba(63, 63, 70, 0.85)",
  borderRadius: 16,
  fontSize: 12,
  color: "#fafafa",
  boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
  padding: "10px 12px",
};

export function compactAxis(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `R$ ${(value / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}
