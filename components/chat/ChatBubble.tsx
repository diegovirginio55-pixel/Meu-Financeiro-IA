import type { ChatUiMessage } from "@/lib/finance/chat-types";
import { extractChatCard } from "@/lib/finance/chat-card";
import { formatCurrency } from "@/lib/finance/format";

function ChatSummaryCard({ titulo, itens }: { titulo: string; itens: { label: string; valor: number }[] }) {
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-emerald-800/40 bg-emerald-950/20">
      <p className="border-b border-emerald-800/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-300">
        {titulo}
      </p>
      <div className="grid grid-cols-2 gap-2 p-3">
        {itens.map((item) => (
          <div key={item.label} className="min-w-0">
            <p className="truncate text-[11px] text-zinc-400">{item.label}</p>
            <p className={`text-sm font-semibold ${item.valor < 0 ? "text-rose-300" : "text-zinc-100"}`}>
              {formatCurrency(item.valor)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChatBubble({ message }: { message: ChatUiMessage }) {
  const isUser = message.role === "user";
  const { text, card } = isUser ? { text: message.content, card: null } : extractChatCard(message.content);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm sm:max-w-[70%] lg:max-w-[52%] ${
          isUser
            ? "rounded-2xl rounded-br-md bg-emerald-600 text-white"
            : "rounded-2xl rounded-bl-md border border-zinc-800 bg-zinc-900/80 text-zinc-100"
        }`}
      >
        {message.pending ? (
          <span className="flex items-center gap-1 py-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" />
          </span>
        ) : (
          <>
            {text}
            {card && <ChatSummaryCard titulo={card.titulo} itens={card.itens} />}
          </>
        )}
      </div>
    </div>
  );
}
