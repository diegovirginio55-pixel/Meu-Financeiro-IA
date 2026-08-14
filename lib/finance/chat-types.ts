export interface ChatUiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
}
