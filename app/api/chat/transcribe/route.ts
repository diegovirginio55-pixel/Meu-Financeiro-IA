import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { genAI, GEMINI_MODEL } from "@/lib/ai/gemini";
import { geminiRetryAt, getQuotaView, isGeminiQuotaError, lockQuota } from "@/lib/ai/quota";
import { readChatQuota, writeChatQuota } from "@/lib/ai/quota-cookie";

export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const quotaState = await readChatQuota();
  const quota = getQuotaView(quotaState);
  if (quota.limited) {
    return NextResponse.json({ error: quota.label, quota }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Áudio vazio." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Áudio muito longo." }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "audio/webm";

  try {
    const response = await genAI.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: buffer.toString("base64"),
              },
            },
            {
              text: "Transcreva o áudio em português do Brasil. Responda somente com o texto falado, com pontuação natural. Sem aspas, prefixos nem comentários. Se não houver fala, responda vazio.",
            },
          ],
        },
      ],
    });

    const text = (response.text ?? "")
      .trim()
      .replace(/^["'«»]+|["'«»]+$/g, "")
      .trim();

    return NextResponse.json({ text, quota });
  } catch (error) {
    if (isGeminiQuotaError(error)) {
      const locked = lockQuota(quotaState, geminiRetryAt(error));
      const nextQuota = getQuotaView(locked);
      await writeChatQuota(locked);
      return NextResponse.json({ error: nextQuota.label, quota: nextQuota }, { status: 429 });
    }
    return NextResponse.json({ error: "Não deu para entender o áudio. Tente de novo." }, { status: 500 });
  }
}
