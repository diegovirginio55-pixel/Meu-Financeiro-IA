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
