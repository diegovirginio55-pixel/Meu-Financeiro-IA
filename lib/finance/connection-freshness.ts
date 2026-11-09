/**
 * Quão novos são os dados de um banco. O app lê a Pluggy a cada poucos
 * minutos (last_synced_at), mas a Pluggy só busca dados no banco de tempos
 * em tempos — no Meu Pluggy, 1 vez a cada 24 h. Mostrar a hora da leitura
 * ("atualizado hoje às 15h") dava a impressão de saldo em dia mesmo com
 * dados de ontem. O sync guarda em status_detail a hora real dos dados
 * (lastUpdatedAt do item) e a próxima atualização automática.
 */
export type ConnectionFreshness = {
  /** Quando a Pluggy buscou os dados no banco pela última vez. */
  dataUpdatedAt: string | null;
  /** Próxima busca automática prevista pela Pluggy. */
  nextAutoSyncAt: string | null;
};

export function connectionFreshness(connection: {
  status_detail?: string | null;
  last_synced_at?: string | null;
}): ConnectionFreshness {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = connection.status_detail ? (JSON.parse(connection.status_detail) as Record<string, unknown>) : {};
  } catch {
    parsed = {};
  }
  const dataUpdatedAt = typeof parsed.dataUpdatedAt === "string" ? parsed.dataUpdatedAt : null;
  const nextAutoSyncAt = typeof parsed.nextAutoSyncAt === "string" ? parsed.nextAutoSyncAt : null;
  return {
    // Antes do primeiro sync com esta versão, cai na hora da leitura (comportamento antigo).
    dataUpdatedAt: dataUpdatedAt ?? connection.last_synced_at ?? null,
    nextAutoSyncAt,
  };
}

/** Horas desde que o banco mais desatualizado teve dados novos (null se nenhum). */
export function oldestDataAgeHours(
  connections: { status_detail?: string | null; last_synced_at?: string | null }[],
  now: number,
): { hours: number; at: string } | null {
  let oldest: { hours: number; at: string } | null = null;
  for (const connection of connections) {
    const { dataUpdatedAt } = connectionFreshness(connection);
    if (!dataUpdatedAt) continue;
    const hours = (now - new Date(dataUpdatedAt).getTime()) / 3_600_000;
    if (!oldest || hours > oldest.hours) oldest = { hours, at: dataUpdatedAt };
  }
  return oldest;
}
