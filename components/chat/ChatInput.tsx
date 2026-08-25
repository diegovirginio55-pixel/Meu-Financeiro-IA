"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import type { ChatQuotaView } from "@/lib/ai/quota";

const MAX_SECONDS = 60;

function pickMimeType() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return types.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) ?? "";
}

function formatTimer(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function ChatInput({
  disabled,
  locked,
  onSend,
  onQuota,
}: {
  disabled: boolean;
  locked?: boolean;
  onSend: (message: string) => void;
  onQuota?: (quota: ChatQuotaView) => void;
}) {
  const [value, setValue] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelledRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const busy = disabled || transcribing;
  const hasText = value.trim().length > 0;

  useEffect(() => {
    return () => stopTracks();
  }, []);

  function stopTracks() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function submit(text = value) {
    const trimmed = text.trim();
    if (!trimmed || busy || recording) return;
    onSend(trimmed);
    setValue("");
    setError("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  async function startRecording() {
    if (busy || recording) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Este aparelho não permite gravar áudio.");
      return;
    }

    setError("");
    cancelledRef.current = false;
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stopTracks();
        setRecording(false);
        recorderRef.current = null;
        if (cancelledRef.current || elapsedRef.current < 1 || blob.size < 800) {
          if (!cancelledRef.current && elapsedRef.current < 1) {
            setError("Áudio muito curto. Segure um pouco mais.");
          }
          return;
        }
        void transcribe(blob);
      };

      recorder.start(200);
      elapsedRef.current = 0;
      setElapsed(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
        if (elapsedRef.current >= MAX_SECONDS) finishRecording();
      }, 1000);
    } catch {
      stopTracks();
      setError("Permita o microfone para gravar o áudio.");
    }
  }

  function finishRecording() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }

  function cancelRecording() {
    cancelledRef.current = true;
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    } else {
      stopTracks();
      setRecording(false);
    }
  }

  async function transcribe(blob: Blob) {
    setTranscribing(true);
    setError("");
    try {
      const form = new FormData();
      const extension = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      form.append("audio", blob, `audio.${extension}`);
      const res = await fetch("/api/chat/transcribe", { method: "POST", body: form });
      const data: { text?: string; error?: string; quota?: ChatQuotaView } = await res.json();
      if (data.quota) onQuota?.(data.quota);
      const text = (data.text ?? "").trim();
      if (!res.ok || !text) {
        setError(data.error || "Não deu para entender o áudio. Tente de novo.");
        return;
      }
      setValue((current) => (current.trim() ? `${current.trim()} ${text}` : text));
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch {
      setError("Não foi possível transcrever. Tente de novo.");
    } finally {
      setTranscribing(false);
    }
  }

  function handleAction() {
    if (recording) {
      finishRecording();
      return;
    }
    if (hasText) {
      submit();
      return;
    }
    void startRecording();
  }

  return (
    <div className="pb-1">
      <div className="flex items-end gap-2">
        <div className="flex min-h-12 flex-1 items-center gap-3 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          {recording ? (
            <>
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/30" />
                <span className="relative h-2.5 w-2.5 rounded-full bg-rose-500" />
              </span>
              <p className="flex-1 text-sm font-medium tabular-nums tracking-wide text-zinc-100">
                {formatTimer(elapsed)}
                <span className="ml-2 font-normal text-zinc-500">gravando</span>
              </p>
              <button
                type="button"
                onClick={cancelRecording}
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white"
                aria-label="Cancelar gravação"
              >
                <CloseIcon />
              </button>
            </>
          ) : transcribing ? (
            <>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-zinc-950">
                ✦
              </span>
              <p className="flex-1 text-sm text-zinc-400">Passando o áudio para texto…</p>
            </>
          ) : (
            <>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm text-zinc-950">
                ✦
              </span>
              <textarea
                ref={inputRef}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={locked ? "Limite de perguntas atingido" : "O que você quer saber sobre seu dinheiro?"}
                rows={1}
                disabled={busy}
                className="max-h-24 flex-1 resize-none bg-transparent py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
              />
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleAction}
          disabled={busy || (recording && elapsed < 1)}
          aria-label={recording ? "Parar e transcrever" : hasText ? "Enviar mensagem" : "Gravar áudio"}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-lg transition active:scale-95 disabled:opacity-40 ${
            recording
              ? "bg-rose-500 text-white shadow-rose-500/30"
              : hasText
                ? "bg-white text-zinc-950 shadow-white/10"
                : "bg-emerald-500 text-zinc-950 shadow-emerald-500/25"
          }`}
        >
          {transcribing ? <SpinnerIcon /> : recording ? <StopIcon /> : hasText ? <SendIcon /> : <MicIcon />}
        </button>
      </div>
      {error ? <p className="mt-2 px-1 text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M3.4 11.2 19.2 4.4c.7-.3 1.4.4 1.1 1.1l-6.8 15.8c-.3.8-1.5.8-1.8 0l-2.3-6.1a1 1 0 0 0-.6-.6l-6.1-2.3c-.8-.3-.8-1.5 0-1.8Z" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <rect x="9" y="3.5" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <rect x="7" y="7" width="10" height="10" rx="2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 animate-spin" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.4" />
      <path d="M20 12a8 8 0 0 0-8-8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
