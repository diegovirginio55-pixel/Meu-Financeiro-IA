// Sem "use client": função pura, serve no servidor e no cliente.

/**
 * Marca do estabelecimento a partir da descrição do lançamento ("IFOOD
 * *RESTAURANTE", "UBER *TRIP"…), para o extrato mostrar um ícone com a cor
 * da marca — tudo local, sem buscar logos na internet.
 */
export type MerchantBrand = { name: string; label: string; background: string; color: string };

type Rule = { pattern: RegExp; name: string; label: string; background: string; color?: string };

const RULES: Rule[] = [
  { pattern: /\bifood\b|\bifd\*/, name: "iFood", label: "iF", background: "#EA1D2C" },
  { pattern: /\buber\b/, name: "Uber", label: "U", background: "#000000" },
  { pattern: /\b99\s?(app|pop|taxi|food|tecnologia)\b|\b99app\b/, name: "99", label: "99", background: "#FFDD00", color: "#111111" },
  { pattern: /netflix/, name: "Netflix", label: "N", background: "#E50914" },
  { pattern: /spotify/, name: "Spotify", label: "S", background: "#1DB954" },
  { pattern: /youtube/, name: "YouTube", label: "▶", background: "#FF0000" },
  { pattern: /prime\s?video|amazon|amzn/, name: "Amazon", label: "a", background: "#FF9900", color: "#111111" },
  { pattern: /mercado\s?livre|mercadolivre|meli\b|mercado\s?pago|mercadopago/, name: "Mercado Livre", label: "ML", background: "#FFE600", color: "#2D3277" },
  { pattern: /shopee/, name: "Shopee", label: "S", background: "#EE4D2D" },
  { pattern: /magalu|magazine\s?luiza/, name: "Magalu", label: "M", background: "#0086FF" },
  { pattern: /aliexpress/, name: "AliExpress", label: "A", background: "#E43225" },
  { pattern: /shein/, name: "Shein", label: "S", background: "#111111" },
  { pattern: /rappi/, name: "Rappi", label: "R", background: "#FF441F" },
  { pattern: /\bgoogle\b|google\s?play/, name: "Google", label: "G", background: "#4285F4" },
  { pattern: /\bapple\b|itunes|apple\.com/, name: "Apple", label: "A", background: "#1D1D1F" },
  { pattern: /disney/, name: "Disney+", label: "D+", background: "#113CCF" },
  { pattern: /\bhbo\b|\bmax\.com/, name: "Max", label: "M", background: "#002BE7" },
  { pattern: /steam/, name: "Steam", label: "S", background: "#171A21" },
  { pattern: /carrefour/, name: "Carrefour", label: "C", background: "#004E9F" },
  { pattern: /pao de acucar/, name: "Pão de Açúcar", label: "PA", background: "#2E7D32" },
  { pattern: /assai/, name: "Assaí", label: "A", background: "#E30613" },
  { pattern: /atacadao/, name: "Atacadão", label: "A", background: "#F37021" },
  { pattern: /drogasil/, name: "Drogasil", label: "D", background: "#E30613" },
  { pattern: /droga\s?raia|\braia\b/, name: "Droga Raia", label: "R", background: "#00843D" },
  { pattern: /pague\s?menos/, name: "Pague Menos", label: "PM", background: "#004A98" },
  { pattern: /\bshell\b/, name: "Shell", label: "S", background: "#FFD500", color: "#DD1D21" },
  { pattern: /ipiranga/, name: "Ipiranga", label: "I", background: "#FFC20E", color: "#004B87" },
  { pattern: /petrobras|posto\s?br\b/, name: "Petrobras", label: "BR", background: "#008542" },
  { pattern: /mc\s?donald|mcdonalds/, name: "McDonald's", label: "M", background: "#DA291C", color: "#FFC72C" },
  { pattern: /burger\s?king/, name: "Burger King", label: "BK", background: "#D62300" },
  { pattern: /starbucks/, name: "Starbucks", label: "S", background: "#00704A" },
  { pattern: /\bclaro\b/, name: "Claro", label: "C", background: "#DA291C" },
  { pattern: /\bvivo\b|telefonica/, name: "Vivo", label: "V", background: "#660099" },
  { pattern: /\btim\b/, name: "TIM", label: "T", background: "#004691" },
  { pattern: /nubank|\bnu pagamentos/, name: "Nubank", label: "nu", background: "#820AD1" },
  { pattern: /\binter\b|banco inter/, name: "Inter", label: "in", background: "#FF7A00" },
  { pattern: /picpay/, name: "PicPay", label: "P", background: "#21C25E" },
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function merchantBrand(description: string | null | undefined): MerchantBrand | null {
  if (!description) return null;
  const text = normalize(description);
  const rule = RULES.find((item) => item.pattern.test(text));
  return rule ? { name: rule.name, label: rule.label, background: rule.background, color: rule.color ?? "#FFFFFF" } : null;
}
