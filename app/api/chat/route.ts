import { NextResponse } from "next/server";
import type { Content, Part } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { genAI, buildSystemPrompt, GEMINI_MODEL } from "@/lib/ai/gemini";
import { toolDefinitions, executeTool } from "@/lib/ai/tools";
import { getFinancialSnapshot } from "@/lib/finance/summary";

const MAX_TOOL_ITERATIONS = 6;
const HISTORY_LIMIT = 30;

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

  return NextResponse.json({ messages: data ?? [] });
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

  const { data: historyRows } = await supabase
    .from("chat_messages")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(HISTORY_LIMIT);

  await supabase
    .from("chat_messages")
    .insert({ user_id: user.id, role: "user", content: userMessage });

  const snapshot = await getFinancialSnapshot(supabase);
  const system = buildSystemPrompt(snapshot);

  const contents: Content[] = (historyRows ?? []).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  contents.push({ role: "user", parts: [{ text: userMessage }] });

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

    const responseParts = response.candidates?.[0]?.content?.parts ?? [];
    contents.push({ role: "model", parts: responseParts });

    const functionCalls = response.functionCalls ?? [];

    if (response.text) finalText = response.text;

    if (functionCalls.length === 0) {
      break;
    }

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

  return NextResponse.json({ reply: finalText });
}
