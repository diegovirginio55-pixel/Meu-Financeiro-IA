import { NextResponse } from "next/server";
import type { Content, Part } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { genAI, buildSystemPrompt, GEMINI_MODEL } from "@/lib/ai/gemini";
import { consumeQuestion, geminiRetryAt, getQuotaView, isGeminiQuotaError, lockQuota } from "@/lib/ai/quota";
import { readChatQuota, writeChatQuota } from "@/lib/ai/quota-cookie";
import { toolDefinitions, executeTool } from "@/lib/ai/tools";
import { getFinancialSnapshot } from "@/lib/finance/summary";

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

export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const messages = (data ?? []).filter(
    (row) =>
      !(
        row.role === "assistant" &&
        typeof row.content === "string" &&
        row.content.startsWith("Você atingiu o limite de perguntas")
      ),
  );
  const quota = getQuotaView(await readChatQuota());
  return NextResponse.json({ messages, quota });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.from("chat_messages").delete().eq("user_id", userData.user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, quota: getQuotaView(await readChatQuota()) });
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

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ reply: "A chave da IA não está configurada no servidor." });
  }

  const quotaState = await readChatQuota();
  const quotaBefore = getQuotaView(quotaState);
  if (quotaBefore.limited) {
    return NextResponse.json(
      { limited: true, error: quotaBefore.label, quota: quotaBefore },
      { status: 429 },
    );
  }

  const { data: historyRows } = await supabase
    .from("chat_messages")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(HISTORY_LIMIT);

  const { data: inserted } = await supabase
    .from("chat_messages")
    .insert({ user_id: user.id, role: "user", content: userMessage })
    .select("id")
    .maybeSingle();

  try {
    const snapshot = await getFinancialSnapshot(supabase);
    const system = buildSystemPrompt(snapshot);
    const contents = historyContents(historyRows, userMessage);

    let finalText = "";
    const toolCallsLog: unknown[] = [];

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
        toolResultParts.push({
          functionResponse: { name, response: { result } },
        });
      }
      contents.push({ role: "user", parts: toolResultParts });
    }

    if (!finalText) {
      finalText = "Entendi, já registrei isso para você.";
    }

    await supabase.from("chat_messages").insert({
      user_id: user.id,
      role: "assistant",
      content: finalText,
      tool_calls: toolCallsLog.length > 0 ? toolCallsLog : null,
    });

    const nextState = consumeQuestion(quotaState);
    const quota = getQuotaView(nextState);
    await writeChatQuota(nextState);
    return NextResponse.json({ reply: finalText, quota });
  } catch (error) {
    console.error("Erro no chat com a IA:", error);
    if (isGeminiQuotaError(error)) {
      const locked = lockQuota(quotaState, geminiRetryAt(error));
      const quota = getQuotaView(locked);
      await writeChatQuota(locked);
      if (inserted?.id) {
        await supabase.from("chat_messages").delete().eq("id", inserted.id);
      }
      return NextResponse.json({ limited: true, error: quota.label, quota }, { status: 429 });
    }
    await supabase.from("chat_messages").insert({
      user_id: user.id,
      role: "assistant",
      content: FALLBACK_REPLY,
    });
    return NextResponse.json({ reply: FALLBACK_REPLY, quota: quotaBefore });
  }
}
