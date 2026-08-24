"use client";

import { useState, type KeyboardEvent } from "react";

export default function ChatInput({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (message: string) => void;
}) {
  const [value, setValue] = useState("");

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex items-center gap-2 pb-1">
      <div className="flex flex-1 items-center gap-3 rounded-full border border-zinc-800 bg-zinc-900/70 px-4 py-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm text-zinc-950">
          ✦
        </span>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="O que você quer saber sobre seu dinheiro?"
          rows={1}
          className="max-h-24 flex-1 resize-none bg-transparent py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
        />
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={disabled || !value.trim()}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-sm font-medium text-zinc-950 disabled:opacity-40"
      >
        →
      </button>
    </div>
  );
}
