import type { Account, Card, Transaction } from "./types";
import { formatCurrency, formatDate } from "./format";
import { accountBankLabel, cardBankLabel } from "./account-name";

export interface ExportPdfOptions {
  title: string;
  subtitle?: string;
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
  return "—";
}

/**
 * Gera e baixa um PDF com o extrato filtrado atual, direto no navegador
 * (sem chamada ao servidor) — usa exatamente os lançamentos já carregados
 * na tela, respeitando os filtros e a busca aplicados.
 */
export async function exportTransactionsPdf({
  title,
  subtitle,
  transactions,
  accounts,
  cards,
  fileName,
}: ExportPdfOptions): Promise<void> {
  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default;

  const doc = new jsPDF();
  const totalEntradas = transactions.filter((t) => t.type === "entrada").reduce((s, t) => s + Number(t.amount), 0);
  const totalSaidas = transactions.filter((t) => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0);
  const saldo = totalEntradas - totalSaidas;

  doc.setFontSize(16);
  doc.text("Meu Financeiro IA", 14, 18);
  doc.setFontSize(12);
  doc.text(title, 14, 26);
  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(subtitle, 14, 32);
    doc.setTextColor(0);
  }

  doc.setFontSize(10);
  doc.text(`Entradas: ${formatCurrency(totalEntradas)}`, 14, 40);
  doc.text(`Saídas: ${formatCurrency(totalSaidas)}`, 80, 40);
  doc.text(`Saldo: ${formatCurrency(saldo)}`, 146, 40);

  const rows = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t) => [
      formatDate(t.date),
      t.description,
      t.category,
      labelFor(t, accounts, cards),
      `${t.type === "entrada" ? "+" : "-"}${formatCurrency(Number(t.amount))}`,
    ]);

  autoTable(doc, {
    startY: 46,
    head: [["Data", "Descrição", "Categoria", "Conta/Cartão", "Valor"]],
    body: rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [16, 185, 129] },
    columnStyles: { 4: { halign: "right" } },
  });

  doc.save(fileName ?? `extrato-${new Date().toISOString().slice(0, 10)}.pdf`);
}
