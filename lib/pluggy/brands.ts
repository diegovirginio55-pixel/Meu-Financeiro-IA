export type BankBrand = {
  bg: string;
  fg: string;
  label: string;
  logo?: string;
};

const BRANDS: Record<string, BankBrand> = {
  Nubank: { bg: "#820AD1", fg: "#FFFFFF", label: "Nubank", logo: "/bancos/nubank.svg" },
  Inter: { bg: "#FF7A00", fg: "#FFFFFF", label: "Inter", logo: "/bancos/inter.svg" },
  Caixa: { bg: "#1074B2", fg: "#FFFFFF", label: "Caixa Econômica Federal", logo: "/bancos/caixa.svg" },
  "Caixa Econômica Federal": {
    bg: "#1074B2",
    fg: "#FFFFFF",
    label: "Caixa Econômica Federal",
    logo: "/bancos/caixa.svg",
  },
  Itaú: { bg: "#EC7000", fg: "#FFFFFF", label: "Itaú", logo: "/bancos/itau.svg" },
  "Banco do Brasil": { bg: "#F9DD16", fg: "#003DA5", label: "Banco do Brasil", logo: "/bancos/bb.svg" },
  Bradesco: { bg: "#CC092F", fg: "#FFFFFF", label: "Bradesco" },
  Santander: { bg: "#EC0000", fg: "#FFFFFF", label: "Santander" },
  "C6 Bank": { bg: "#222222", fg: "#FFFFFF", label: "C6 Bank" },
  PicPay: { bg: "#21C25E", fg: "#FFFFFF", label: "PicPay" },
  "Mercado Pago": { bg: "#00BCFF", fg: "#FFFFFF", label: "Mercado Pago" },
  PagBank: { bg: "#5A2D82", fg: "#FFFFFF", label: "PagBank" },
  "BTG Pactual": { bg: "#C4A35A", fg: "#1A1A1A", label: "BTG Pactual" },
  Original: { bg: "#00A868", fg: "#FFFFFF", label: "Original" },
  Neon: { bg: "#00D4AA", fg: "#04251C", label: "Neon" },
};

function brandKey(name: string): string {
  const normalized = name.trim();
  if (BRANDS[normalized]) return normalized;
  const found = Object.keys(BRANDS).find((key) =>
    normalized.toLowerCase().includes(key.toLowerCase()),
  );
  return found ?? normalized;
}

export function getBankBrand(name: string): BankBrand | null {
  return BRANDS[brandKey(name)] ?? null;
}

export function officialInstitutionName(name: string): string {
  return getBankBrand(name)?.label ?? name;
}

export function brandInitials(name: string): string {
  const official = officialInstitutionName(name);
  if (official === "Caixa Econômica Federal") return "CEF";
  if (official === "Banco do Brasil") return "BB";
  if (official === "C6 Bank") return "C6";
  if (official === "Mercado Pago") return "MP";
  if (official === "BTG Pactual") return "BTG";
  const words = official.split(/\s+/).filter(Boolean);
  if (words.length === 1) return official.slice(0, 2).toUpperCase();
  return words.slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
