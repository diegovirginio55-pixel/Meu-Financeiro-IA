import type { ChatUiMessage } from "@/lib/finance/chat-types";

export default function ChatBubble({ message }: { message: ChatUiMessage }) {
  const isUser = message.role === "user";

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
          message.content
        )}
      </div>
    </div>
  );
}
