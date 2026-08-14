import ChatWindow from "@/components/chat/ChatWindow";

export default function ChatPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-zinc-50">
          Conversa com a IA
        </h1>
        <p className="text-sm text-zinc-400">
          Conte suas movimentações em linguagem natural — a IA organiza tudo
          para você.
        </p>
      </div>
      <ChatWindow />
    </div>
  );
}
