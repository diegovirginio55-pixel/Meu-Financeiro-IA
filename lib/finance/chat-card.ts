export interface ChatCardItem {
  label: string;
  valor: number;
}

export interface ChatCard {
  titulo: string;
  itens: ChatCardItem[];
}

const CARD_PATTERN = /\[\[CARD:(\{[\s\S]*?\})\]\]/;

/**
 * A IA pode terminar respostas de resumo financeiro com um bloco
 * "[[CARD:{...}]]" (ver prompt em lib/ai/gemini.ts) que o app usa pra
 * desenhar um cartão visual com os números, em vez de só texto corrido.
 * Essa função separa o texto normal do bloco estruturado.
 */
export function extractChatCard(content: string): { text: string; card: ChatCard | null } {
  const match = content.match(CARD_PATTERN);
  if (!match) return { text: content, card: null };

  const text = content.replace(CARD_PATTERN, "").trim();
  try {
    const parsed = JSON.parse(match[1]) as Partial<ChatCard>;
    if (!Array.isArray(parsed.itens) || parsed.itens.length === 0) return { text, card: null };
    const itens = parsed.itens
      .filter((item) => item && typeof item.label === "string" && Number.isFinite(Number(item.valor)))
      .map((item) => ({ label: item.label, valor: Number(item.valor) }));
    if (itens.length === 0) return { text, card: null };
    return { text, card: { titulo: typeof parsed.titulo === "string" ? parsed.titulo : "Resumo", itens } };
  } catch {
    return { text, card: null };
  }
}
