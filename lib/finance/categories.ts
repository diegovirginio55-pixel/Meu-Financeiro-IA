export const CATEGORIES = [
  "Salário",
  "Alimentação",
  "Transporte",
  "Moradia",
  "Educação",
  "Saúde",
  "Lazer",
  "Assinaturas",
  "Compras",
  "Investimentos",
  "Dívidas",
  "Outros",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_ICONS: Record<string, string> = {
  Salário: "💰",
  Alimentação: "🍔",
  Transporte: "🚗",
  Moradia: "🏠",
  Educação: "🎓",
  Saúde: "💊",
  Lazer: "🎬",
  Assinaturas: "📱",
  Compras: "🛍️",
  Investimentos: "📈",
  Dívidas: "🧾",
  Outros: "🔖",
};

export const CATEGORY_COLORS: Record<string, string> = {
  Salário: "#10b981",
  // Tons ajustados (validados para fundo escuro e daltonismo): âmbar, ciano e laranja um pouco mais escuros.
  Alimentação: "#d97706",
  Transporte: "#3b82f6",
  Moradia: "#8b5cf6",
  Educação: "#ec4899",
  Saúde: "#ef4444",
  Lazer: "#0891b2",
  Assinaturas: "#ea580c",
  Compras: "#a855f7",
  Investimentos: "#22c55e",
  Dívidas: "#dc2626",
  Outros: "#71717a",
};

const FALLBACK_PALETTE = [
  "#ef4444",
  "#a855f7",
  "#3b82f6",
  "#ec4899",
  "#06b6d4",
  "#eab308",
  "#f97316",
  "#22c55e",
];

export function categoryColor(category: string): string {
  if (CATEGORY_COLORS[category]) return CATEGORY_COLORS[category];
  let hash = 0;
  for (let i = 0; i < category.length; i += 1) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];
}

function normalizeDescription(description: string): string {
  return description
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const CATEGORY_HINTS: Array<[RegExp, Category]> = [
  [/ifood|rappi|uber\s*eats|restaurante|lanchonete|padaria|supermercado|carrefour|atacadao|pao de acucar|mcdonald|burger|pizza|outback|habib|starbucks|cacau show/, "Alimentação"],
  [/uber|99app|99 pop|metro|onibus|passagem|posto\b|shell|ipiranga|petrobras|raizen|\balcool\b|\bdiesel\b|estacionamento|sem parar|veloe/, "Transporte"],
  [/aluguel|condominio|energia|enel|cemig|copel|light|sabesp|copasa|saneamento|internet|vivo|claro|\btim\b|net virtua|oi fibra|aluguel/, "Moradia"],
  [/escola|faculdade|universidade|curso|udemy|alura|mensalidade|livro|educacao/, "Educação"],
  [/farmacia|drogaria|raia|pacheco|panvel|unimed|amil|sulamerica|hapvida|hospital|clinica|laboratorio|saude/, "Saúde"],
  [/netflix|spotify|disney|hbo|prime video|youtube|apple.com\/bill|google\s*one|paramount|crunchyroll|assinatura/, "Assinaturas"],
  [/cinema|show|ingresso|steam|playstation|xbox|lazer|bar\b|balada|clube/, "Lazer"],
  [/magazine|magalu|amazon|shopee|mercado livre|americanas|casas bahia|renner|shein|compras/, "Compras"],
  [/fatura|emprestimo|financiamento|credito consignado/, "Dívidas"],
];

export function inferCategoryFromDescription(description: string): Category | null {
  const text = normalizeDescription(description);
  if (!text) return null;
  for (const [pattern, category] of CATEGORY_HINTS) {
    if (pattern.test(text)) return category;
  }
  return null;
}

export function resolvedCategory(transaction: { category: string; description: string }): string {
  if (transaction.category && transaction.category !== "Outros" && transaction.category !== "Salário") {
    return transaction.category;
  }
  if (transaction.category === "Salário") return "Salário";
  return inferCategoryFromDescription(transaction.description) ?? transaction.category ?? "Outros";
}

export interface CategoryRule {
  pattern: string;
  category: string;
}

/**
 * Regras de categorização criadas manualmente pelo usuário (ex: "toda
 * transação com 'Uber' vira Transporte"). Têm prioridade sobre a inferência
 * automática por palavra-chave. Retorna null se nenhuma regra bater.
 */
export function applyCategoryRules(description: string, rules: CategoryRule[]): string | null {
  const text = normalizeDescription(description);
  for (const rule of rules) {
    const pattern = normalizeDescription(rule.pattern);
    if (pattern && text.includes(pattern)) return rule.category;
  }
  return null;
}

export function isTransferDescription(description: string): boolean {
  if (inferCategoryFromDescription(description)) return false;
  const text = normalizeDescription(description);
  return /\b(pix|ted|doc|tef)\b/.test(text) || /transferencia/.test(text);
}

/**
 * Categorias que não dizem nada sobre o destino do dinheiro: "Outros" é o
 * padrão de saída e "Salário" é o padrão de qualquer crédito importado.
 * Quando um Pix/TED tem uma categoria diferente dessas (escolhida pelo
 * usuário, por regra ou pela Pluggy — ex.: aluguel em "Moradia"), ele é um
 * gasto/renda de verdade, não uma transferência entre contas.
 */
const GENERIC_CATEGORIES = new Set(["Outros", "Salário", ""]);

export function isInternalTransfer(transaction: { description: string; category?: string | null }): boolean {
  if (!isTransferDescription(transaction.description)) return false;
  return GENERIC_CATEGORIES.has(transaction.category ?? "");
}

const BILL_WORDS = /\b(pagamento|pagto|pgto|pag|debito|deb|liquidacao|quitacao)\b/;

/**
 * Pagamento de fatura de cartão. As compras do cartão já entram como gasto
 * (cada uma, no próprio cartão); contar também o pagamento da fatura na
 * conta dobrava a despesa do mês. Pelo mesmo motivo, créditos lançados no
 * próprio cartão (pagamento recebido, estorno) não são renda.
 */
export function isCardBillPayment(transaction: {
  type: string;
  description: string;
  card_id?: string | null;
}): boolean {
  if (transaction.card_id) return transaction.type === "entrada";
  if (transaction.type !== "saida") return false;
  const text = normalizeDescription(transaction.description);
  if (/\bfatura\b/.test(text) && BILL_WORDS.test(text)) return true;
  return /pagamento\s+(de\s+|do\s+)?cartao(\s+de\s+credito)?\b/.test(text);
}
