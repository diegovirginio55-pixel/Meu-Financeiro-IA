import { describe, expect, it } from "vitest";
import { merchantBrand } from "../merchants";

describe("marca do estabelecimento no extrato", () => {
  it("reconhece as marcas mais comuns pela descrição do banco", () => {
    expect(merchantBrand("IFOOD *RESTAURANTE")?.name).toBe("iFood");
    expect(merchantBrand("UBER *TRIP HELP.UBER.COM")?.name).toBe("Uber");
    expect(merchantBrand("Netflix.com")?.name).toBe("Netflix");
    expect(merchantBrand("MERCADOLIVRE*VENDEDOR")?.name).toBe("Mercado Livre");
    expect(merchantBrand("Pão de Açúcar Loja 123")?.name).toBe("Pão de Açúcar");
    expect(merchantBrand("AMAZON MARKETPLACE")?.name).toBe("Amazon");
  });

  it("não inventa marca para descrições genéricas", () => {
    expect(merchantBrand("Pix para JOAO PEREIRA")).toBeNull();
    expect(merchantBrand("PADARIA CENTRAL")).toBeNull();
    expect(merchantBrand("")).toBeNull();
    // "tim" só como palavra inteira (não em "TIMBÓ" nem "OTIMO").
    expect(merchantBrand("MERCADO OTIMO")).toBeNull();
  });
});
