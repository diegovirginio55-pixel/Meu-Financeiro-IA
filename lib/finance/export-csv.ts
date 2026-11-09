import type { Account, Card, Transaction } from "./types";
import { accountBankLabel, cardBankLabel } from "./account-name";
import { saoPauloTodayKey } from "./fluxo";

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

/**
 * Célula segura para Excel/Sheets: texto que começa com = + - @ (ou tab/CR)
 * seria executado como fórmula — e a descrição vem do banco/Pix, escrita
 * por terceiros (ex.: "=HYPERLINK(...)"). Prefixa com apóstrofo.
 */
export function csvCell(value: string, { numeric = false }: { numeric?: boolean } = {}): string {
  let safe = value;
  if (!numeric && /^[=+\-@\t\r]/.test(safe)) safe = `'${safe}`;
  if (/[";\n\r]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
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
      Number(t.amount).toFixed(2).replace(".", ","),
    ]);

  const valueColumn = header.length - 1;
  const csv = [header, ...rows]
    .map((row) => row.map((cell, index) => csvCell(cell, { numeric: index === valueColumn })).join(";"))
    .join("\r\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName ?? `extrato-${saoPauloTodayKey()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
