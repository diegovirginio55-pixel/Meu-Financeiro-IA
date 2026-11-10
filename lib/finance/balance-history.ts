/** Linha de `account_balance_snapshots` usada para montar o histórico do saldo. */
export type BalanceSnapshotRow = { account_id: string; snapshot_date: string; balance: number | string };

export type BalancePoint = { date: string; balance: number };

/** Teto de segurança para não gerar listas enormes por uma data errada. */
const MAX_DAYS = 800;

/** Dias entre duas datas "AAAA-MM-DD", inclusive. */
export function dayKeysBetween(from: string, to: string, maxDays = MAX_DAYS): string[] {
  const keys: string[] = [];
  const cursor = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (cursor <= end && keys.length < maxDays) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

/**
 * Saldo diário somando todas as contas, de `start` até `end` (inclusive).
 * Dia sem foto de uma conta repete o último saldo conhecido dela — senão a
 * soma "despencava" nos dias em que um banco não atualizou. Fotos antes de
 * `start` só servem para já começar o período com o último saldo de cada
 * conta. Dias antes da primeira foto de qualquer conta ficam de fora.
 */
export function dailyBalanceHistory(rows: BalanceSnapshotRow[], start: string, end: string): BalancePoint[] {
  const sorted = [...rows].sort(
    (a, b) => a.snapshot_date.localeCompare(b.snapshot_date) || a.account_id.localeCompare(b.account_id),
  );
  const lastByAccount = new Map<string, number>();
  let index = 0;
  const apply = (row: BalanceSnapshotRow) => lastByAccount.set(row.account_id, Number(row.balance) || 0);

  while (index < sorted.length && sorted[index].snapshot_date < start) apply(sorted[index++]);

  const history: BalancePoint[] = [];
  for (const key of dayKeysBetween(start, end)) {
    while (index < sorted.length && sorted[index].snapshot_date <= key) apply(sorted[index++]);
    if (lastByAccount.size === 0) continue;
    let total = 0;
    for (const value of lastByAccount.values()) total += value;
    history.push({ date: key, balance: Math.round(total * 100) / 100 });
  }
  return history;
}
