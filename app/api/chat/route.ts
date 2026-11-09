import { NextResponse } from "next/server";
import type { Content, Part } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { genAI, buildSystemPrompt, GEMINI_MODEL } from "@/lib/ai/gemini";
import { consumeQuestion, geminiRetryAt, getQuotaView, isGeminiQuotaError, lockQuota } from "@/lib/ai/quota";
import { readChatQuota, writeChatQuota } from "@/lib/ai/quota-cookie";
import { toolDefinitions, executeTool } from "@/lib/ai/tools";
import { getFinancialSnapshot } from "@/lib/finance/summary";
import { formatCurrency } from "@/lib/finance/format";
import { serverError } from "@/lib/api/errors";

export const maxDuration = 60;

const MAX_TOOL_ITERATIONS = 6;
const HISTORY_LIMIT = 20;
const FALLBACK_REPLY = "Não consegui responder agora. Tente de novo em instantes.";

function historyContents(
  rows: { role: string; content: string | null }[] | null,
  currentMessage: string,
): Content[] {
  const merged: { role: "user" | "model"; text: string }[] = [];
  for (const row of rows ?? []) {
    const text = (row.content ?? "").trim();
    if (!text) continue;
    if (text.startsWith("Erro ao conectar com a IA")) continue;
    const role: "user" | "model" = row.role === "assistant" ? "model" : "user";
    const last = merged[merged.length - 1];
    if (last && last.role === role) last.text += `\n\n${text}`;
    else merged.push({ role, text });
  }

  const contents: Content[] = merged.map((item) => ({
    role: item.role,
    parts: [{ text: item.text }],
  }));

  const last = contents[contents.length - 1];
  if (last?.role === "user" && last.parts?.[0] && "text" in last.parts[0]) {
    last.parts[0].text = `${last.parts[0].text}\n\n${currentMessage}`;
    return contents;
  }
  contents.push({ role: "user", parts: [{ text: currentMessage }] });
  return contents;
}


const MAX_MESSAGE_CHARS = 2000;

/**
 * Últimas N mensagens em ordem cronológica. Antes a consulta era
 * "ordem crescente + limite", que pega as MAIS ANTIGAS: depois de 20
 * mensagens a IA só via o começo da conversa, e depois de 100 as mensagens
 * novas sumiam da tela ao recarregar.
 */
async function latestMessages(supabase: Awaited<ReturnType<typeof createClient>>, limit: number) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return { data: (data ?? []).reverse(), error };
}

type WriteResult = { name: string; result: Record<string, unknown> };

const WRITE_TOOLS = new Set([
  "create_transaction",
  "set_account_balance",
  "set_card_invoice",
  "create_recurring_item",
  "create_debt",
  "mark_debt_paid",
  "create_goal",
  "add_to_goal",
]);

/** Resumo do que foi gravado de fato, para responder mesmo se a IA falhar depois. */
function describeWrites(writes: WriteResult[]): string | null {
  const lines = writes
    .filter((item) => item.result.success === true)
    .map(({ name, result }) => {
      if (name === "create_transaction") {
        const tx = result.transaction as { description?: string; amount?: number; type?: string } | undefined;
        if (tx) return `• ${tx.type === "entrada" ? "Entrada" : "Saída"} de ${formatCurrency(Number(tx.amount))} — ${tx.description}`;
      }
      if (name === "set_account_balance") return `• Saldo de ${result.account_name} atualizado para ${formatCurrency(Number(result.balance))}`;
      if (name === "set_card_invoice") return `• Fatura de ${result.card_name} atualizada para ${formatCurrency(Number(result.current_invoice))}`;
      if (name === "add_to_goal") return `• Meta "${result.goal_name}" agora em ${formatCurrency(Number(result.current_amount))}`;
      return "• Registro salvo";
    });
  if (lines.length === 0) return null;
  return `Registrei:\n${lines.join("\n")}`;
}

export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await latestMessages(supabase, 100);
  if (error) return serverError("Não foi possível carregar a conversa.", error);

  const messages = data.filter(
    (row) =>
      !(
        row.role === "assistant" &&
        typeof row.content === "string" &&
        row.content.startsWith("Você atingiu o limite de perguntas")
      ),
  );
  const quota = getQuotaView(await readChatQuota(supabase, userData.user.id));
  return NextResponse.json({ messages, quota });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.from("chat_messages").delete().eq("user_id", userData.user.id);
  if (error) return serverError("Não foi possível apagar a conversa.", error);

  return NextResponse.json({ ok: true, quota: getQuotaView(await readChatQuota(supabase, userData.user.id)) });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const userMessage = (body?.message ?? "").toString().trim();

  if (!userMessage) {
    return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
  }
  if (userMessage.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json(
      { error: `Mensagem muito longa (máximo de ${MAX_MESSAGE_CHARS} caracteres).` },
      { status: 400 },
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ reply: "A chave da IA não está configurada no servidor." });
  }

  const quotaState = await readChatQuota(supabase, user.id);
  const quotaBefore = getQuotaView(quotaState);
  if (quotaBefore.limited) {
    return NextResponse.json(
      { limited: true, error: quotaBefore.label, quota: quotaBefore },
      { status: 429 },
    );
  }

  const { data: historyRows } = await latestMessages(supabase, HISTORY_LIMIT);

  const { data: inserted } = await supabase
    .from("chat_messages")
    .insert({ user_id: user.id, role: "user", content: userMessage })
    .select("id")
    .maybeSingle();

  const toolCallsLog: unknown[] = [];
  const writes: WriteResult[] = [];

  try {
    const snapshot = await getFinancialSnapshot(supabase);
    const system = buildSystemPrompt(snapshot);
    const contents = historyContents(historyRows, userMessage);

    let finalText = "";

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await genAI.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
          systemInstruction: system,
          tools: [{ functionDeclarations: toolDefinitions }],
        },
      });

      const modelContent = response.candidates?.[0]?.content;
      if (modelContent?.parts?.length) {
        contents.push({ role: "model", parts: modelContent.parts });
      }

      const functionCalls = response.functionCalls ?? [];
      if (response.text) finalText = response.text;

      if (functionCalls.length === 0) break;

      const toolResultParts: Part[] = [];
      for (const call of functionCalls) {
        const name = call.name ?? "";
        toolCallsLog.push({ name, input: call.args });
        const result = await executeTool(
          supabase,
          user.id,
          name,
          (call.args ?? {}) as Record<string, unknown>,
        );
        if (WRITE_TOOLS.has(name) && result && typeof result === "object") {
          writes.push({ name, result: result as Record<string, unknown> });
        }
        toolResultParts.push({
          functionResponse: { name, response: { result } },
        });
      }
      contents.push({ role: "user", parts: toolResultParts });
    }

    if (!finalText) {
      // Só diz que registrou se algo foi mesmo gravado.
      finalText = describeWrites(writes) ?? "Não consegui entender. Pode reformular a mensagem?";
    }

    await supabase.from("chat_messages").insert({
      user_id: user.id,
      role: "assistant",
      content: finalText,
      tool_calls: toolCallsLog.length > 0 ? toolCallsLog : null,
    });

    const nextState = consumeQuestion(quotaState);
    const quota = getQuotaView(nextState);
    await writeChatQuota(supabase, user.id, nextState);
    return NextResponse.json({ reply: finalText, quota });
  } catch (error) {
    console.error("Erro no chat com a IA:", error);
    // Se alguma ferramenta já gravou dados, a mensagem do usuário fica e a
    // resposta diz o que foi registrado — senão ele repetia a pergunta e o
    // lançamento (e o saldo) ficavam duplicados.
    const saved = describeWrites(writes);

    if (isGeminiQuotaError(error)) {
      const locked = lockQuota(quotaState, geminiRetryAt(error));
      const quota = getQuotaView(locked);
      await writeChatQuota(supabase, user.id, locked);
      if (saved) {
        const reply = `${saved}\n\n${quota.label}`;
        await supabase.from("chat_messages").insert({
          user_id: user.id,
          role: "assistant",
          content: reply,
          tool_calls: toolCallsLog,
        });
        return NextResponse.json({ reply, quota });
      }
      if (inserted?.id) {
        await supabase.from("chat_messages").delete().eq("id", inserted.id);
      }
      return NextResponse.json({ limited: true, error: quota.label, quota }, { status: 429 });
    }

    const reply = saved
      ? `${saved}\n\nNão consegui terminar a resposta, mas o que está acima já foi salvo — não precisa repetir.`
      : FALLBACK_REPLY;
    await supabase.from("chat_messages").insert({
      user_id: user.id,
      role: "assistant",
      content: reply,
      tool_calls: toolCallsLog.length > 0 ? toolCallsLog : null,
    });
    return NextResponse.json({ reply, quota: quotaBefore });
  }
}
