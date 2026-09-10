"use client";

const SUGGESTIONS = [
  "Quanto gastei esse mês?",
  "Como está minha saúde financeira?",
  "Quanto posso gastar por dia?",
  "Qual foi meu maior gasto do mês?",
  "Vou fechar o mês no azul?",
];

export function ChatSuggestionChips({
  disabled,
  onPick,
}: {
  disabled?: boolean;
  onPick: (text: string) => void;
}) {
  return (
    <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
      {SUGGESTIONS.map((text) => (
        <button
          key={text}
          type="button"
          disabled={disabled}
          onClick={() => onPick(text)}
          className="shrink-0 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
        >
          {text}
        </button>
      ))}
    </div>
  );
}
