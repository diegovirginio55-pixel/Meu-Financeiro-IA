"use client";

import { useEffect, useRef, useState } from "react";
import ChatBubble from "./ChatBubble";
import ChatInput from "./ChatInput";
import type { ChatUiMessage } from "@/lib/finance/chat-types";
import type { ChatMessageRow } from "@/lib/finance/types";

export default function ChatWindow() {
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    let active = true;
    fetch("/api/chat")
      .then((res) => res.json())
      .then((data: { messages?: ChatMessageRow[] }) => {
        if (!active) return;
        const loaded: ChatUiMessage[] = (data.messages ?? []).map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        }));
        setMessages(loaded);
      })
      .finally(() => {
        if (active) setLoadingHistory(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function revealText(id: string, text: string) {
    let i = 0;
    const step = Math.max(1, Math.floor(text.length / 60));
    const interval = setInterval(() => {
      i += step;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, content: text.slice(0, i) } : m,
        ),
      );
      if (i >= text.length) clearInterval(interval);
    }, 18);
  }

  async function handleSend(message: string) {
    const userMsg: ChatUiMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: message,
    };
    const pendingId = `pending-${Date.now()}`;
    const pendingMsg: ChatUiMessage = {
      id: pendingId,
      role: "assistant",
      content: "",
      pending: true,
    };
    setMessages((prev) => [...prev, userMsg, pendingMsg]);
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data: { reply?: string; error?: string } = await res.json();
      const reply =
        data.reply ?? "Não consegui processar sua mensagem agora, tente novamente.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId ? { ...m, content: "", pending: false } : m,
        ),
      );
      revealText(pendingId, reply);
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                content: "Erro ao conectar com a IA. Tente novamente.",
                pending: false,
              }
            : m,
        ),
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-9.5rem)] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {loadingHistory ? (
          <p className="text-center text-sm text-zinc-500">
            Carregando conversa...
          </p>
        ) : messages.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl bg-zinc-800 px-4 py-3 text-sm text-zinc-300">
            👋 Oi! Sou sua IA financeira. Me conte o que aconteceu:
            recebimentos, gastos, contas fixas, dívidas... Eu registro tudo e
            te ajudo a entender sua situação financeira.
          </div>
        ) : (
          messages.map((m) => <ChatBubble key={m.id} message={m} />)
        )}
        <div ref={bottomRef} />
      </div>
      <ChatInput disabled={sending} onSend={handleSend} />
    </div>
  );
}
