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
  Alimentação: "#f59e0b",
  Transporte: "#3b82f6",
  Moradia: "#8b5cf6",
  Educação: "#ec4899",
  Saúde: "#ef4444",
  Lazer: "#06b6d4",
  Assinaturas: "#f97316",
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

export function isTransferDescription(description: string): boolean {
  if (inferCategoryFromDescription(description)) return false;
  const text = normalizeDescription(description);
  return /\b(pix|ted|doc|tef)\b/.test(text) || /transferencia/.test(text);
}
