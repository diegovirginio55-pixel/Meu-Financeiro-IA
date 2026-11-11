import { describe, expect, it } from "vitest";
import { phoneProblem, phoneView } from "../phone-status";
import { groupSubscriptions } from "@/lib/finance/subscriptions";
import { makeTx } from "@/lib/finance/__tests__/fixtures";

const NOW = new Date("2026-11-11T15:00:00Z");

describe("estado do app Android", () => {
  it("tudo certo: sem aviso", () => {
    expect(phoneProblem({ version: "1.0.7", listener: true, at: "2026-11-11T12:00:00Z" }, NOW)).toBeNull();
    expect(phoneProblem(null, NOW)).toBeNull();
  });

  it("leitor desligado ou celular sem sinal há mais de um dia viram aviso", () => {
    expect(phoneProblem({ version: "1.0.7", listener: false, at: "2026-11-11T12:00:00Z" }, NOW)?.kind).toBe("phone_listener_off");
    expect(phoneProblem({ version: "1.0.7", listener: true, at: "2026-11-10T10:00:00Z" }, NOW)?.kind).toBe("phone_silent");
  });

  it("mostra há quanto tempo o app deu sinal", () => {
    expect(phoneView({ version: "1.0.7", listener: true, at: "2026-11-11T12:00:00Z" }, NOW)).toEqual({
      version: "1.0.7",
      listener: true,
      ago: "há 3 h",
      silent: false,
    });
  });
});

describe("assinaturas", () => {
  it("Pix para a mesma pessoa todo mês não é assinatura", () => {
    const pix = ["2026-09-10", "2026-10-13", "2026-11-09"].map((date, index) =>
      makeTx({ date, amount: index === 2 ? 816.76 : 81.24, type: "saida", category: "Outros", description: "Pix enviado  - Izoleide Mangueira Da Cruz" }),
    );
    const netflix = ["2026-09-05", "2026-10-05", "2026-11-05"].map((date) =>
      makeTx({ date, amount: 39.9, type: "saida", category: "Assinaturas", description: "NETFLIX.COM" }),
    );
    expect(groupSubscriptions([...pix, ...netflix]).map((group) => group.key)).toEqual(["netflix com"]);
  });
});
