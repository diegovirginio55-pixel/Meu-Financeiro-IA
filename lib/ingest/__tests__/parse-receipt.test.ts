import { describe, expect, it } from "vitest";
import { parseReceipt } from "../parse-receipt";

function parsed(text: string) {
  const result = parseReceipt(text);
  if (!result.ok) throw new Error(`ignorado: ${result.reason}`);
  return result.parsed;
}

describe("comprovante compartilhado do app do banco", () => {
  it("Inter: Pix enviado (texto lido da imagem, linha a linha)", () => {
    const text = [
      "inter",
      "Pix enviado",
      "R$ 81,24",
      "Sobre a transação",
      "Data do pagamento Terça, 10/11/2026",
      "Horário 20h14",
      "ID da transação",
      "E004169682026111023145pa63pn4xVV",
      "Quem recebeu",
      "Nome Izoleide Mangueira da Cruz",
      "CPF/CNPJ ***.040.138-**",
      "Instituição Bco Bradesco S.A.",
      "Quem pagou",
      "Nome DIEGO VIRGINO ADRIANI ISIDORO",
      "CPF/CNPJ ***.023.996-**",
      "Instituição Banco Inter S.A.",
    ].join("\n");
    expect(parsed(text)).toEqual({
      amount: 81.24,
      type: "saida",
      kind: "account",
      bank: "Inter",
      description: "Pix para Izoleide Mangueira da Cruz",
      date: "2026-11-10",
      transactionId: "E004169682026111023145pa63pn4xVV",
    });
  });

  it("Nubank: comprovante de transferência com data por extenso", () => {
    const text = [
      "Comprovante de transferência",
      "10 NOV 2026 - 20:14:33",
      "Valor R$ 1.250,00",
      "Tipo de transferência Pix",
      "Destino",
      "Nome MARIA DA SILVA",
      "CPF •••.040.138-••",
      "Instituição BCO BRADESCO S.A.",
      "Origem",
      "Nome Diego Virgino Adriani Isidoro",
      "Instituição NU PAGAMENTOS - IP",
    ].join("\n");
    expect(parsed(text)).toMatchObject({
      amount: 1250,
      type: "saida",
      bank: "Nubank",
      description: "Pix para Maria da Silva",
      date: "2026-11-10",
    });
  });

  it("Caixa: dados do recebedor e do pagador", () => {
    const text = [
      "Comprovante de Pix",
      "Data/Hora 09/11/2026 - 18:02",
      "Tarifa R$ 0,00",
      "Valor R$ 100,00",
      "Dados do recebedor",
      "Nome PADARIA CENTRAL LTDA",
      "Dados do pagador",
      "Nome DIEGO VIRGINO ADRIANI ISIDORO",
      "Instituição CAIXA ECONOMICA FEDERAL",
    ].join("\n");
    expect(parsed(text)).toMatchObject({ amount: 100, bank: "Caixa", description: "Pix para Padaria Central Ltda", date: "2026-11-09" });
  });

  it("Pix recebido: o banco é o de quem recebeu", () => {
    const text = [
      "Pix recebido",
      "R$ 30,00",
      "Quem pagou",
      "Nome Ana Souza",
      "Instituição Nu Pagamentos S.A.",
      "Quem recebeu",
      "Nome Diego Virgino Adriani Isidoro",
      "Instituição Banco Inter S.A.",
    ].join("\n");
    expect(parsed(text)).toMatchObject({ amount: 30, type: "entrada", bank: "Inter", description: "Recebido de Ana Souza" });
  });

  it("sem a instituição de quem pagou, o banco vem do identificador do Pix", () => {
    const text = ["Pix enviado", "R$ 10,00", "Quem recebeu", "Nome Ana Souza", "ID E004169682026111023145pa63pn4xVV"].join("\n");
    expect(parsed(text)).toMatchObject({ bank: "Inter", description: "Pix para Ana Souza" });
  });

  it("imagem que não é comprovante é ignorada", () => {
    expect(parseReceipt("Promoção! Ganhe R$ 50,00 de cashback").ok).toBe(false);
    expect(parseReceipt("Comprovante de Pix\nQuem recebeu\nNome Ana").ok).toBe(false);
  });
});
