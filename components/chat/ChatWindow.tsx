"use client";

import { useEffect, useRef, useState } from "react";
import ChatBubble from "./ChatBubble";
import ChatInput from "./ChatInput";
import type { ChatUiMessage } from "@/lib/finance/chat-types";
import type { ChatMessageRow } from "@/lib/finance/types";
import type { ChatQuotaView } from "@/lib/ai/quota";
import { PageHero, PageShell } from "@/components/ui/page-chrome";
import { extractChatCard } from "@/lib/finance/chat-card";
import { ChatSuggestionChips } from "./ChatSuggestionChips";

/** Intervalo da "digitação" da resposta: passos maiores e menos renders (leve em celular fraco). */
const REVEAL_TICK_MS = 40;
const REVEAL_STEPS = 30;
/** Distância do fim (px) em que ainda consideramos que o usuário está "colado" no fim da conversa. */
const STICK_THRESHOLD_PX = 80;
const MAX_TIMEOUT_MS = 2_147_483_647;

export default function ChatWindow() {
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [quota, setQuota] = useState<ChatQuotaView | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [expiredLock, setExpiredLock] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const revealTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rola para o fim (sem animação) só quando o usuário já está no fim da conversa.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottom.current) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight > 1) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Para a animação de digitação ao sair da tela.
  useEffect(() => {
    return () => {
      if (revealTimer.current) clearInterval(revealTimer.current);
      revealTimer.current = null;
    };
  }, []);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
  }

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
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoadingHistory(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Bloqueio temporário: em vez de comparar com Date.now() no render, um timer marca quando ele expira.
  const lockedUntil = quota?.lockedUntil ?? null;
  useEffect(() => {
    if (!lockedUntil) return;
    const remainingMs = new Date(lockedUntil).getTime() - Date.now();
    const id = window.setTimeout(() => setExpiredLock(lockedUntil), Math.min(MAX_TIMEOUT_MS, Math.max(0, remainingMs)));
    return () => window.clearTimeout(id);
  }, [lockedUntil]);
  const lockActive = lockedUntil != null && expiredLock !== lockedUntil;

  const limitedNow = Boolean(quota?.limited) || (quota != null && quota.remaining <= 0) || lockActive;

  useEffect(() => {
    if (!limitedNow) return;
    let cancelled = false;
    function check() {
      fetch("/api/chat")
        .then((res) => res.json())
        .then((data: { quota?: ChatQuotaView }) => {
          if (!cancelled && data.quota) setQuota(data.quota);
        })
        .catch(() => undefined);
    }
    // Reconsulta o limite periodicamente enquanto bloqueado: mais confiável do que um
    // único temporizador cronometrado, que pode travar a tela se o horário previsto
    // já tiver passado por qualquer diferença de relógio ou falha de rede.
    const id = window.setInterval(check, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [limitedNow]);

  function revealText(id: string, fullReply: string) {
    // Se a resposta terminar com o bloco "[[CARD:{...}]]" (resumo estruturado),
    // revela só o texto visível animando, e mostra o cartão só ao final —
    // senão o JSON cru apareceria piscando durante a digitação.
    const { text } = extractChatCard(fullReply);
    if (revealTimer.current) clearInterval(revealTimer.current);
    let i = 0;
    const step = Math.max(12, Math.ceil(text.length / REVEAL_STEPS));
    const interval = setInterval(() => {
      // Avança vários caracteres por vez e termina no fim de uma palavra.
      let next = Math.min(text.length, i + step);
      const space = text.indexOf(" ", next);
      if (space !== -1 && space - next < 24) next = space;
      i = next;
      const done = i >= text.length;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, content: done ? fullReply : text.slice(0, i) } : m,
        ),
      );
      if (done) {
        clearInterval(interval);
        if (revealTimer.current === interval) revealTimer.current = null;
      }
    }, REVEAL_TICK_MS);
    revealTimer.current = interval;
  }

  async function handleSend(message: string) {
    stickToBottom.current = true;
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
      if (data.quota) {
        setQuota(
          data.quota.limited || data.limited
            ? { ...data.quota, remaining: 0, limited: true }
            : data.quota,
        );
      }
      const blocked = res.status === 429 || data.limited || data.quota?.limited;
      if (blocked && (data.reply?.startsWith("Você atingiu o limite") || !data.reply)) {
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
  const limited = limitedNow;
  const remaining = limited ? 0 : (quota?.remaining ?? 0);

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
                  {limited ? "Limite atingido" : `Disponíveis ${remaining} perguntas`}
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
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 space-y-3 overflow-y-auto pb-3">
          {loadingHistory ? (
            <p className="text-center text-sm text-zinc-500">Carregando conversa...</p>
          ) : messages.length === 0 ? (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 px-4 py-4 text-sm leading-relaxed text-zinc-300">
              Oi. Sou sua IA financeira. Conte recebimentos, gastos, contas e dívidas em linguagem natural.
            </div>
          ) : (
            messages.map((m) => <ChatBubble key={m.id} message={m} />)
          )}
        </div>
        {quota ? (
          <p className={`mb-2 px-1 text-xs ${limited ? "text-amber-300" : "text-zinc-500"}`}>
            {quota.label}
          </p>
        ) : null}
        <ChatSuggestionChips disabled={sending || limited} onPick={handleSend} />
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
