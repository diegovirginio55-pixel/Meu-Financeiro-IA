import { describe, expect, it } from "vitest";
import { counterpartyFromDescription, isBlandDescription, mentionsOwnName } from "../categories";
import { categorizePluggyTransaction } from "@/lib/pluggy/categorize";

const OWNER = ["DIEGO VIRGINO ADRIANI ISIDORO"];
const ME = { documentNumber: { type: "CPF", value: "123.456.789-01" } };

describe("nome de quem recebeu/pagou", () => {
  it("lê o nome nas descrições dos bancos e dos avisos", () => {
    expect(counterpartyFromDescription("Pix enviado  - Izoleide Mangueira Da Cruz")).toBe("izoleide mangueira da cruz");
    expect(counterpartyFromDescription("Transferência Recebida|DIEGO VIRGINO ADRIANI ISIDORO")).toBe("diego virgino adriani isidoro");
    expect(counterpartyFromDescription("Pix para JOAO PEREIRA com sucesso")).toBe("joao pereira");
    expect(counterpartyFromDescription("Recebido de MARIA DA SILVA")).toBe("maria da silva");
  });

  it("descrição sem nome não vira regra", () => {
    expect(counterpartyFromDescription("DEB PIX CHAVE")).toBeNull();
    expect(counterpartyFromDescription("DEB PIX QR COD EST")).toBeNull();
    expect(counterpartyFromDescription("COMPRA CARTAO DEBITO")).toBeNull();
    expect(counterpartyFromDescription("Pix enviado")).toBeNull();
  });

  it("reconhece o titular mesmo abreviado, mas não um xará", () => {
    expect(mentionsOwnName("Pix enviado - Diego Virgino Adriani Isidoro", OWNER)).toBe(true);
    expect(mentionsOwnName("Recebido de DIEGO V A ISIDORO", OWNER)).toBe(true);
    expect(mentionsOwnName("Pix para Diego Souza", OWNER)).toBe(false);
    expect(mentionsOwnName("Pix para Izoleide", OWNER)).toBe(false);
  });

  it("descrições vazias do banco", () => {
    expect(isBlandDescription("COMPRA CARTAO DEBITO")).toBe(true);
    expect(isBlandDescription("DEB PIX QR COD EST")).toBe(true);
    expect(isBlandDescription("CRED PIX CHAVE")).toBe(true);
    expect(isBlandDescription("SUPERMERCADO BOM PRECO")).toBe(false);
    expect(isBlandDescription("Pix para Ana")).toBe(false);
  });
});

describe("categoria dos lançamentos do Meu Pluggy", () => {
  it("transferência para o próprio CPF não é gasto nem renda", () => {
    expect(categorizePluggyTransaction({ type: "DEBIT", description: "DEB PIX QR COD EST", category: "Same person transfer" })).toBe(
      "Transferências",
    );
    expect(
      categorizePluggyTransaction({
        type: "DEBIT",
        description: "DEB PIX CHAVE",
        category: "Transfer - PIX",
        paymentData: { payer: ME, receiver: ME },
      }),
    ).toBe("Transferências");
    expect(
      categorizePluggyTransaction(
        { type: "CREDIT", description: "Pix recebido - Diego Virgino Adriani Isidoro", category: null },
        { ownerNames: OWNER },
      ),
    ).toBe("Transferências");
  });

  it("Pix para outra pessoa e QR Code de loja são gasto", () => {
    expect(categorizePluggyTransaction({ type: "DEBIT", description: "Pix enviado  - Izoleide Mangueira Da Cruz", category: "Transfer - PIX" })).toBe(
      "Outros",
    );
    expect(categorizePluggyTransaction({ type: "DEBIT", description: "DEB PIX QR COD DIN", category: "Services" })).toBe("Outros");
    expect(categorizePluggyTransaction({ type: "DEBIT", description: "Transferência enviada|KEETA DELIVERY BRAZIL LTDA", category: null })).toBe(
      "Alimentação",
    );
  });

  it("fatura paga pela conta não conta em dobro; saque conta", () => {
    expect(categorizePluggyTransaction({ type: "DEBIT", description: "DEB PIX QR COD EST", category: "Credit card payment" })).toBe(
      "Transferências",
    );
    expect(categorizePluggyTransaction({ type: "DEBIT", description: "SAQUE BANCO 24H", category: "Same person transfer - CASH" })).toBe("Outros");
    // No próprio cartão, "Pagamento recebido" já fica fora dos gastos e da renda.
    expect(categorizePluggyTransaction({ type: "CREDIT", description: "Pagamento recebido", category: "Credit card payment" }, { onCard: true })).toBe(
      "Outros",
    );
  });

  it("entrada de empresa é salário; de pessoa não", () => {
    const company = { name: "ELDER JUNIOR", documentNumber: { type: "CNPJ", value: "29.288.134/0001-31" } };
    const person = { documentNumber: { type: "CPF", value: "333.444.181-38" } };
    expect(categorizePluggyTransaction({ type: "CREDIT", description: "CRED PIX CHAVE", category: "Transfer - PIX", paymentData: { payer: company, receiver: ME } })).toBe(
      "Salário",
    );
    expect(categorizePluggyTransaction({ type: "CREDIT", description: "CRED PIX CHAVE", category: "Transfer - PIX", paymentData: { payer: person, receiver: ME } })).toBe(
      "Outros",
    );
  });

  it("regra do usuário vale mais que tudo", () => {
    expect(
      categorizePluggyTransaction(
        { type: "DEBIT", description: "Pix enviado - Izoleide Mangueira Da Cruz", category: "Same person transfer" },
        { customRules: [{ pattern: "izoleide mangueira da cruz", category: "Moradia" }] },
      ),
    ).toBe("Moradia");
  });
});
