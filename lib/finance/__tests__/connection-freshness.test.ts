import { describe, expect, it } from "vitest";
import { connectionFreshness, oldestDataAgeHours } from "../connection-freshness";

describe("idade dos dados do banco", () => {
  it("usa a hora em que a Pluggy buscou no banco, não a hora da leitura do app", () => {
    const freshness = connectionFreshness({
      last_synced_at: "2026-11-09T18:00:00Z",
      status_detail: JSON.stringify({ dataUpdatedAt: "2026-11-08T20:33:57Z", nextAutoSyncAt: "2026-11-09T20:33:57Z" }),
    });
    expect(freshness).toEqual({ dataUpdatedAt: "2026-11-08T20:33:57Z", nextAutoSyncAt: "2026-11-09T20:33:57Z" });
  });

  it("sem a informação (sync antigo), cai na hora da leitura", () => {
    expect(connectionFreshness({ last_synced_at: "2026-11-09T18:00:00Z", status_detail: null }).dataUpdatedAt).toBe(
      "2026-11-09T18:00:00Z",
    );
    expect(connectionFreshness({ last_synced_at: null, status_detail: "lixo" }).dataUpdatedAt).toBeNull();
  });

  it("aponta o banco mais desatualizado", () => {
    const now = Date.parse("2026-11-09T18:00:00Z");
    const oldest = oldestDataAgeHours(
      [
        { status_detail: JSON.stringify({ dataUpdatedAt: "2026-11-09T00:00:00Z" }) },
        { status_detail: JSON.stringify({ dataUpdatedAt: "2026-11-08T20:00:00Z" }) },
      ],
      now,
    );
    expect(oldest).toEqual({ hours: 22, at: "2026-11-08T20:00:00Z" });
  });
});
