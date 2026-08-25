import { formatCurrency } from "@/lib/finance/format";

export type MovementNotice = {
  description: string;
  amount: number;
  type: "entrada" | "saida" | string;
  date?: string;
};

export type PushPayload = {
  title: string;
  body: string;
  url: string;
};

export function movementPayloads(bankName: string, movements: MovementNotice[]): PushPayload[] {
  if (movements.length === 0) return [];

  if (movements.length > 6) {
    const saidas = movements.filter((item) => item.type === "saida").length;
    const entradas = movements.filter((item) => item.type === "entrada").length;
    const parts = [
      `${movements.length} movimentações novas`,
      entradas > 0 ? `${entradas} entrada${entradas === 1 ? "" : "s"}` : null,
      saidas > 0 ? `${saidas} saída${saidas === 1 ? "" : "s"}` : null,
    ].filter(Boolean);
    return [
      {
        title: bankName,
        body: parts.join(" · "),
        url: "/detalhes",
      },
    ];
  }

  return movements.map((item) => {
    const kind = item.type === "entrada" ? "Entrada" : item.type === "saida" ? "Saída" : "Movimentação";
    return {
      title: bankName,
      body: `${kind} de ${formatCurrency(Number(item.amount))} · ${item.description}`,
      url: "/detalhes",
    };
  });
}
