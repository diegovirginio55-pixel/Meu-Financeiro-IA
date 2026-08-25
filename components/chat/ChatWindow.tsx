"use client";

import { useEffect, useRef, useState } from "react";
import ChatBubble from "./ChatBubble";
import ChatInput from "./ChatInput";
import type { ChatUiMessage } from "@/lib/finance/chat-types";
import type { ChatMessageRow } from "@/lib/finance/types";
import type { ChatQuotaView } from "@/lib/ai/quota";
import { PageHero, PageShell } from "@/components/ui/page-chrome";

export default function ChatWindow() {
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [quota, setQuota] = useState<ChatQuotaView | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    let active = true;
    fetch("/api/chat")
      .then((res) => res.json())
      .then((data: { messages?: ChatMessageRow[]; quota?: ChatQuotaView }) => {
        if (!active) return;
        const loaded: ChatUiMessage[] = (data.messages ?? []).map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        }));
        setMessages(loaded);
        if (data.quota) setQuota(data.quota);
      })
      .finally(() => {
        if (active) setLoadingHistory(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!quota?.lockedUntil) return;
    const wait = new Date(quota.lockedUntil).getTime() - Date.now();
    const timer = window.setTimeout(() => {
      fetch("/api/chat")
        .then((res) => res.json())
        .then((data: { quota?: ChatQuotaView }) => {
          if (data.quota) setQuota(data.quota);
        })
        .catch(() => undefined);
    }, Math.max(400, wait + 250));
    return () => window.clearTimeout(timer);
  }, [quota?.lockedUntil]);

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
      const raw = await res.text();
      let data: { reply?: string; error?: string; quota?: ChatQuotaView; limited?: boolean } = {};
      try {
        data = raw
          ? (JSON.parse(raw) as { reply?: string; error?: string; quota?: ChatQuotaView; limited?: boolean })
          : {};
      } catch {
        data = {};
      }
      if (data.quota) setQuota(data.quota);
      if (res.status === 429 && !data.reply) {
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id && m.id !== pendingId));
        return;
      }
      const reply =
        data.reply ??
        data.error ??
        "Não consegui processar sua mensagem agora, tente novamente.";
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

  async function handleClear() {
    if (messages.length === 0 || clearing) return;
    if (!confirm("Apagar toda a conversa? Isso não pode ser desfeito.")) return;
    setClearing(true);
    try {
      const res = await fetch("/api/chat", { method: "DELETE" });
      const data: { quota?: ChatQuotaView } = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error("fail");
      setMessages([]);
      if (data.quota) setQuota(data.quota);
    } catch {
      alert("Não deu para apagar a conversa agora. Tente de novo.");
    } finally {
      setClearing(false);
    }
  }

  const canClear = messages.length > 0 && !loadingHistory;
  const limited = Boolean(quota?.limited);

  return (
    <PageShell>
      <PageHero
        kicker="IA"
        title={
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h1 className="text-[34px] font-semibold leading-[1.05] tracking-tight text-white lg:text-5xl">
              Conversa
            </h1>
            <div className="relative z-10 mb-1 flex shrink-0 items-center gap-2">
              {quota ? (
                <p
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                    limited ? "bg-amber-400/15 text-amber-200" : "bg-emerald-400/10 text-emerald-300"
                  }`}
                >
                  {limited ? "Limite atingido" : `Disponíveis ${quota.remaining} perguntas`}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => void handleClear()}
                disabled={!canClear || clearing}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-zinc-950 disabled:opacity-40"
              >
                {clearing ? "Apagando..." : "Apagar conversa"}
              </button>
            </div>
          </div>
        }
        subtitle="Pergunte sobre gastos, saldo e investimentos"
      />
      <div className="flex h-[calc(100vh-15rem)] flex-col px-4 lg:h-[calc(100vh-12rem)] lg:px-6 xl:px-10 2xl:px-14">
        <div className="flex-1 space-y-3 overflow-y-auto pb-3">
          {loadingHistory ? (
            <p className="text-center text-sm text-zinc-500">Carregando conversa...</p>
          ) : messages.length === 0 ? (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 px-4 py-4 text-sm leading-relaxed text-zinc-300">
              Oi. Sou sua IA financeira. Conte recebimentos, gastos, contas e dívidas em linguagem natural.
            </div>
          ) : (
            messages.map((m) => <ChatBubble key={m.id} message={m} />)
          )}
          <div ref={bottomRef} />
        </div>
        {quota ? (
          <p className={`mb-2 px-1 text-xs ${limited ? "text-amber-300" : "text-zinc-500"}`}>
            {quota.label}
          </p>
        ) : null}
        <ChatInput
          disabled={sending || limited}
          locked={limited}
          onSend={handleSend}
          onQuota={setQuota}
        />
      </div>
    </PageShell>
  );
}
