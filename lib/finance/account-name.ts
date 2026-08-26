import { getBankBrand, officialInstitutionName } from "@/lib/pluggy/brands";

export function friendlyAccountName(raw: string, type?: string | null): string {
  const last4 = raw.match(/(\d{4})\s*$/)?.[1] ?? null;
  let name = raw.replace(/^[^·•]+[·•]\s*/, "").trim() || raw;
  name = name
    .replace(/\bCP\b/gi, " ")
    .replace(/conta\s*principal/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[·•\-]\s*|\s*[·•\-]$/g, "")
    .trim();

  if (!name || /^conta$/i.test(name)) {
    name = type === "poupanca" ? "Poupança" : "Conta";
  }

  if (last4 && !name.includes(last4)) return `${name} • ${last4}`;
  return name;
}

export function accountBankLabel(account: {
  name: string;
  type?: string | null;
  institution_name?: string | null;
}): string {
  const friendly = friendlyAccountName(account.name, account.type);
  const bank = account.institution_name ? officialInstitutionName(account.institution_name) : null;
  if (!bank) return friendly;
  if (friendly.toLowerCase().includes(bank.toLowerCase())) return friendly;
  const kind = /^\d+$/.test(friendly) ? `Conta ${friendly}` : friendly;
  return `${bank} • ${kind}`;
}

export function cardBankLabel(card: { name: string; institution_name?: string | null }): string {
  const bank = card.institution_name ? officialInstitutionName(card.institution_name) : null;
  if (!bank || card.name.toLowerCase().includes(bank.toLowerCase())) return card.name;
  return `${bank} • ${card.name}`;
}

export function isPlaceholderAccount(account: { name: string; balance: number }): boolean {
  if (Math.abs(Number(account.balance)) >= 0.01) return false;
  if (/\bCP\b/i.test(account.name) || /conta\s*principal/i.test(account.name)) return true;
  const stripped = account.name.replace(/^[^·•]+[·•]\s*/, "").trim() || account.name;
  return !getBankBrand(account.name) && /^(conta|cp)$/i.test(stripped);
}
