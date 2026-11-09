import { NextResponse } from "next/server";

/**
 * Resposta 500 com mensagem amigável. O detalhe técnico (mensagem do
 * Postgres, nomes de tabela/coluna) vai só para o log do servidor, não
 * para o navegador.
 */
export function serverError(message: string, detail?: unknown, init?: { headers?: HeadersInit }) {
  if (detail) console.error(message, detail);
  return NextResponse.json({ error: message }, { status: 500, headers: init?.headers });
}
