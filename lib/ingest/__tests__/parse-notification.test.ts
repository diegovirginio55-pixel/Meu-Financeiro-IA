import { describe, expect, it } from "vitest";
import { parseBankNotification } from "../parse-notification";

function parsed(input: { app?: string; title?: string; text?: string }) {
  const result = parseBankNotification(input);
  if (!result.ok) throw new Error(`ignorada: ${result.reason}`);
  return result.parsed;
}

describe("leitura de notificações dos bancos", () => {
  it("Nubank: compra no crédito", () => {
    expect(
      parsed({
        app: "com.nu.production",
        title: "Compra aprovada",
        text: "Compra de R$ 45,90 APROVADA em IFOOD *RESTAURANTE para o cartão com final 1062.",
      }),
    ).toEqual({ amount: 45.9, type: "saida", kind: "card", bank: "Nubank", description: "IFOOD *RESTAURANTE" });
  });

  it("Nubank: transferência recebida", () => {
    expect(
      parsed({ app: "Nubank", title: "Transferência recebida", text: "Você recebeu uma transferência de R$ 1.250,00 de MARIA DA SILVA." }),
    ).toMatchObject({ amount: 1250, type: "entrada", kind: "account", bank: "Nubank", description: "Recebido de MARIA DA SILVA" });
  });

  it("Inter: compra no cartão com valor no meio do texto", () => {
    expect(
      parsed({
        app: "br.com.intermedium",
        title: "Compra aprovada",
        text: "Compra aprovada no cartão final 5078 no valor de R$ 23,50 em UBER *TRIP.",
      }),
    ).toMatchObject({ amount: 23.5, type: "saida", kind: "card", bank: "Inter", description: "UBER *TRIP" });
  });

  it("Pix enviado vai para a conta (não para o cartão)", () => {
    expect(
      parsed({ app: "Bradesco", title: "Pix enviado", text: "Pix de R$ 80,00 enviado para JOAO PEREIRA com sucesso." }),
    ).toMatchObject({ amount: 80, type: "saida", kind: "account", bank: "Bradesco", description: "Pix para JOAO PEREIRA com sucesso" });
  });

  it("Santander: compra no débito", () => {
    expect(
      parsed({ app: "com.santander.app", title: "Santander", text: "Compra no débito de R$ 12,00 em PADARIA CENTRAL aprovada." }),
    ).toMatchObject({ amount: 12, type: "saida", kind: "account", bank: "Santander" });
  });

  it("Caixa: estorno é entrada", () => {
    expect(parsed({ app: "br.gov.caixa.tem", text: "Estorno de R$ 30,00 realizado na sua conta." })).toMatchObject({
      amount: 30,
      type: "entrada",
      bank: "Caixa",
    });
  });

  it("iPhone (Atalhos/Apple Pay): texto montado, mesmo com o R$ repetido pela variável Valor", () => {
    expect(
      parsed({ app: "Nubank Ultravioleta", title: "Compra aprovada", text: "Compra no cartão de R$ R$ 45,90 em IFOOD" }),
    ).toMatchObject({ amount: 45.9, type: "saida", kind: "card", bank: "Nubank", description: "IFOOD" });
    expect(parsed({ app: "Inter Mastercard", title: "Compra aprovada", text: "Compra no cartão de R$ 12,30 em PADARIA" })).toMatchObject({
      amount: 12.3,
      bank: "Inter",
      kind: "card",
    });
  });

  it("teste do MacroDroid sem notificação real é ignorado (sem gravar nada)", () => {
    expect(parseBankNotification({ app: "", title: "", text: "" })).toEqual({ ok: false, reason: "notificação vazia" });
  });

  it("ignora compra recusada, propaganda e aviso de limite", () => {
    expect(parseBankNotification({ text: "Compra de R$ 99,90 em LOJA X foi recusada." }).ok).toBe(false);
    expect(parseBankNotification({ text: "Você tem R$ 5.000,00 de limite disponível! Aproveite." }).ok).toBe(false);
    expect(parseBankNotification({ text: "Sua fatura de R$ 1.200,00 vence amanhã." }).ok).toBe(false);
    expect(parseBankNotification({ text: "Novidade no app: conheça a caixinha turbo" }).ok).toBe(false);
  });
});
