import ChatWindow from "@/components/chat/ChatWindow";

/** Atalho "Novo gasto" do ícone do app abre aqui com ?novo=gasto: campo já começa com "Gastei ". */
export default async function ChatPage({ searchParams }: { searchParams: Promise<{ novo?: string }> }) {
  const { novo } = await searchParams;
  return <ChatWindow initialMessage={novo === "gasto" ? "Gastei " : undefined} />;
}
