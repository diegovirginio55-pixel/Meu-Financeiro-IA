const COMPE_BANKS: Record<string, string> = {
  "001": "Banco do Brasil",
  "033": "Santander",
  "041": "Banrisul",
  "077": "Inter",
  "104": "Caixa",
  "121": "Agibank",
  "197": "Stone",
  "208": "BTG Pactual",
  "212": "Original",
  "237": "Bradesco",
  "260": "Nubank",
  "290": "PagBank",
  "323": "Mercado Pago",
  "336": "C6 Bank",
  "341": "Itaú",
  "380": "PicPay",
  "389": "Mercantil",
  "422": "Safra",
  "623": "Banco Pan",
  "655": "Neon",
  "748": "Sicredi",
  "756": "Sicoob",
};

const NAME_HINTS: Array<[RegExp, string]> = [
  [/nubank|\broxinho\b|\bnuconta\b|\bnu conta\b|\bnu financeira\b|\bnufin\b/i, "Nubank"],
  [/\binter\b|intermedium|banco\s*inter/i, "Inter"],
  [/\bita[uú]\b/i, "Itaú"],
  [/bradesco/i, "Bradesco"],
  [/santander/i, "Santander"],
  [/\bcaixa\b/i, "Caixa"],
  [/banco do brasil|\bbb\b/i, "Banco do Brasil"],
  [/\bc6\b/i, "C6 Bank"],
  [/picpay/i, "PicPay"],
  [/mercado pago/i, "Mercado Pago"],
  [/pagbank|pagseguro/i, "PagBank"],
  [/\bbtg\b/i, "BTG Pactual"],
  [/original/i, "Original"],
  [/\bneon\b/i, "Neon"],
];

const CNPJ_BANKS: Record<string, string> = {
  "00416968": "Inter",
  "18945670": "Inter",
  "31872495": "Inter",
  "18236120": "Nubank",
  "00360305": "Caixa",
};

function digits(value: string) {
  return value.replace(/\D/g, "");
}

export function bankFromCnpj(value?: string | null): string | null {
  if (!value) return null;
  const raw = digits(value);
  if (raw.length < 8) return null;
  return CNPJ_BANKS[raw.slice(0, 8)] ?? null;
}

export function bankFromTransferNumber(transferNumber?: string | null): string | null {
  if (!transferNumber) return null;
  const compe = transferNumber.split("/")[0]?.replace(/\D/g, "").padStart(3, "0");
  if (!compe) return null;
  return COMPE_BANKS[compe] ?? null;
}

export function bankFromLabel(label?: string | null): string | null {
  if (!label) return null;
  for (const [pattern, name] of NAME_HINTS) {
    if (pattern.test(label)) return name;
  }
  return null;
}

export function isGenericConnectorName(name?: string | null): boolean {
  if (!name) return true;
  return /meu\s*pluggy/i.test(name);
}

export function inferInstitutionName(labels: Array<string | null | undefined>, fallback: string): string {
  for (const label of labels) {
    const fromName = bankFromLabel(label);
    if (fromName) return fromName;
    const fromCnpj = bankFromCnpj(label);
    if (fromCnpj) return fromCnpj;
    const fromCompe = bankFromTransferNumber(label);
    if (fromCompe) return fromCompe;
  }
  return fallback;
}

export function institutionForAccount(
  account: {
    name?: string;
    marketingName?: string | null;
    bankData?: { transferNumber?: string | null } | null;
  },
  fallback: string,
): string {
  return inferInstitutionName(
    [account.marketingName, account.name, account.bankData?.transferNumber],
    fallback,
  );
}

export function singleInstitutionFromAccounts(
  accounts: Array<{
    name?: string;
    marketingName?: string | null;
    bankData?: { transferNumber?: string | null } | null;
  }>,
): string | null {
  const banks = new Set(
    accounts
      .map((account) => institutionForAccount(account, ""))
      .filter((name) => name.length > 0),
  );
  if (banks.size === 1) return [...banks][0];
  return null;
}

export function withInstitutionPrefix(name: string, institution: string | null): string {
  if (!institution) return name;
  const firstWord = institution.split(" ")[0];
  if (name.toLowerCase().includes(firstWord.toLowerCase())) return name;
  return `${institution} · ${name}`;
}
