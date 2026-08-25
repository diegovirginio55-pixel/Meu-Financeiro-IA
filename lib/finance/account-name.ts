import { getBankBrand } from "@/lib/pluggy/brands";

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

export function isPlaceholderAccount(account: { name: string; balance: number }): boolean {
  if (Math.abs(Number(account.balance)) >= 0.01) return false;
  if (/\bCP\b/i.test(account.name) || /conta\s*principal/i.test(account.name)) return true;
  const stripped = account.name.replace(/^[^·•]+[·•]\s*/, "").trim() || account.name;
  return !getBankBrand(account.name) && /^(conta|cp)$/i.test(stripped);
}
