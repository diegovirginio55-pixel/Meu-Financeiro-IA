import type { Account, Card, Transaction } from "./types";
import { accountBankLabel, cardBankLabel } from "./account-name";

export interface ExportCsvOptions {
  transactions: Transaction[];
  accounts: Account[];
  cards: Card[];
  fileName?: string;
}

function labelFor(t: Transaction, accounts: Account[], cards: Card[]): string {
  if (t.card_id) {
    const card = cards.find((c) => c.id === t.card_id);
    return card ? cardBankLabel(card) : "Cartão";
  }
  if (t.account_id) {
    const account = accounts.find((a) => a.id === t.account_id);
    return account ? accountBankLabel(account) : "Conta";
  }
  return "";
}

function csvCell(value: string): string {
  if (/[";\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/**
 * Gera e baixa um CSV com o extrato filtrado atual (compatível com
 * Excel/Google Sheets), direto no navegador — mesmos dados já carregados na
 * tela, respeitando filtros e busca.
 */
export function exportTransactionsCsv({ transactions, accounts, cards, fileName }: ExportCsvOptions): void {
  const header = ["Data", "Descrição", "Categoria", "Conta/Cartão", "Tipo", "Valor"];
  const rows = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t) => [
      t.date,
      t.description,
      t.category,
      labelFor(t, accounts, cards),
      t.type === "entrada" ? "Entrada" : "Saída",
      String(Number(t.amount)).replace(".", ","),
    ]);

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName ?? `extrato-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
