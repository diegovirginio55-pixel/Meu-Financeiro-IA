import { inferInstitutionName } from "@/lib/pluggy/institution";
import { officialInstitutionName } from "@/lib/pluggy/brands";

export function realConnectionId(id: string): string {
  const index = id.indexOf("::");
  return index === -1 ? id : id.slice(0, index);
}

export function connectionBank(id: string): string | null {
  const index = id.indexOf("::");
  return index === -1 ? null : id.slice(index + 2);
}

export function groupedConnectionId(realId: string, bank: string): string {
  return `${realId}::${bank}`;
}

export function institutionFromAssetName(name: string, fallback = "Outros"): string {
  return officialInstitutionName(inferInstitutionName([name], fallback));
}

export function assetMatchesBank(name: string, bank: string | null, fallback = "Outros"): boolean {
  if (!bank) return true;
  return institutionFromAssetName(name, fallback) === bank;
}
