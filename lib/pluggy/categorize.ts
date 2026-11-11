import {
  applyCategoryRules,
  inferCategoryFromDescription,
  isTransferDescription,
  mentionsOwnName,
  TRANSFER_CATEGORY,
  type CategoryRule,
} from "@/lib/finance/categories";
import { isInvestmentDescription } from "@/lib/finance/investment-movements";
import type { PluggyTransaction } from "./client";

/** Categorias da Pluggy (enriquecimento do Open Finance) → categorias do app. */
const CATEGORY_MAP: Record<string, string> = {
  restaurants: "Alimentação",
  "food and drink": "Alimentação",
  "food delivery": "Alimentação",
  "eating out": "Alimentação",
  groceries: "Alimentação",
  transport: "Transporte",
  transportation: "Transporte",
  "auto & transport": "Transporte",
  automotive: "Transporte",
  "gas stations": "Transporte",
  "taxi and ride-hailing": "Transporte",
  "public transportation": "Transporte",
  parking: "Transporte",
  "tolls and in vehicle payment": "Transporte",
  housing: "Moradia",
  rent: "Moradia",
  utilities: "Moradia",
  electricity: "Moradia",
  water: "Moradia",
  telecommunications: "Moradia",
  internet: "Moradia",
  education: "Educação",
  health: "Saúde",
  healthcare: "Saúde",
  pharmacy: "Saúde",
  "wellness and fitness": "Saúde",
  "gyms and fitness centers": "Saúde",
  "health insurance": "Saúde",
  "hospital clinics and labs": "Saúde",
  entertainment: "Lazer",
  leisure: "Lazer",
  travel: "Lazer",
  tickets: "Lazer",
  "gaming": "Lazer",
  subscriptions: "Assinaturas",
  streaming: "Assinaturas",
  "digital services": "Assinaturas",
  "video streaming": "Assinaturas",
  "music streaming": "Assinaturas",
  shopping: "Compras",
  "online shopping": "Compras",
  clothing: "Compras",
  electronics: "Compras",
  investments: "Investimentos",
  "fixed income": "Investimentos",
  "proceeds interests and dividends": "Investimentos",
  loans: "Dívidas",
  "loans and financing": "Dívidas",
  "interests charged": "Dívidas",
  "late payment and overdraft costs": "Dívidas",
  "tax on financial operations": "Dívidas",
  "bank fees": "Dívidas",
  "credit card payment": "Dívidas",
  salary: "Salário",
  income: "Salário",
  retirement: "Salário",
  pension: "Salário",
};

function digits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D+/g, "");
}

/** Mesmo CPF/CNPJ de quem pagou e de quem recebeu. */
function samePersonByDocument(transaction: Pick<PluggyTransaction, "paymentData">): boolean {
  const payer = digits(transaction.paymentData?.payer?.documentNumber?.value);
  const receiver = digits(transaction.paymentData?.receiver?.documentNumber?.value);
  return payer.length >= 11 && payer === receiver;
}

/**
 * Transferência entre as próprias contas (não é gasto nem renda), pelo que
 * o banco informa: a Pluggy marca "Same person transfer" comparando o CPF
 * dos dois lados; sem isso, o mesmo documento no pagador e no recebedor ou o
 * nome do titular na descrição de um Pix. Pagar a fatura do cartão pela
 * conta também só troca dinheiro de lugar (as compras já contam no cartão).
 */
export function isOwnTransfer(
  transaction: Pick<PluggyTransaction, "category" | "description" | "paymentData" | "type">,
  { onCard, ownerNames }: { onCard: boolean; ownerNames: string[] },
): boolean {
  if (onCard) return false;
  const category = (transaction.category ?? "").toLowerCase();
  if (category === "same person transfer") return true;
  if (transaction.type !== "CREDIT" && category === "credit card payment") return true;
  if (samePersonByDocument(transaction)) return true;
  const description = transaction.description ?? "";
  return isTransferDescription(description) && mentionsOwnName(description, ownerNames);
}

/**
 * Crédito sem categoria: com cara de salário ou vindo de empresa (CNPJ) →
 * Salário; o resto (Pix de pessoas, estornos…) → Outros. Antes toda entrada
 * virava "Salário".
 */
export function incomeCategory(description: string, payerDocument?: string | null, onCard = false): string {
  if (onCard) return "Outros";
  const text = description.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/salario|folha|proventos|vencimentos|remuneracao/.test(text)) return "Salário";
  return digits(payerDocument).length === 14 ? "Salário" : "Outros";
}

/**
 * Categoria de um lançamento novo da Pluggy. Ordem: regra do usuário →
 * investimento → transferência entre as próprias contas → palavra-chave da
 * descrição → categoria da Pluggy → padrão (entrada/saída).
 */
export function categorizePluggyTransaction(
  transaction: Pick<PluggyTransaction, "category" | "description" | "paymentData" | "type">,
  {
    onCard = false,
    customRules = [],
    ownerNames = [],
  }: { onCard?: boolean; customRules?: CategoryRule[]; ownerNames?: string[] } = {},
): string {
  const description = transaction.description ?? "";
  const isCredit = transaction.type === "CREDIT";
  if (description) {
    const custom = applyCategoryRules(description, customRules);
    if (custom) return custom;
  }
  if (description && isInvestmentDescription(description)) return "Investimentos";
  if (isOwnTransfer(transaction, { onCard, ownerNames })) return TRANSFER_CATEGORY;
  const inferred = description ? inferCategoryFromDescription(description) : null;
  if (inferred) return inferred;
  const pluggyCategory = (transaction.category ?? "").toLowerCase();
  const mapped = CATEGORY_MAP[pluggyCategory];
  // "Same person transfer - CASH" (saque) não cai aqui: dinheiro sacado vira gasto.
  if (mapped && !(isCredit && mapped === "Dívidas")) return mapped;
  return isCredit ? incomeCategory(description, transaction.paymentData?.payer?.documentNumber?.value, onCard) : "Outros";
}
