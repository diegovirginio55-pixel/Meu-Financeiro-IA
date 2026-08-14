"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

function signupErrorMessage(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "Este e-mail já tem uma conta. Entre com a senha.";
  }
  if (lower.includes("password")) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  if (lower.includes("email")) {
    return "E-mail inválido.";
  }
  return "Não foi possível criar a conta. Tente novamente.";
}

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
    setConfirmPassword("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (mode === "signup" && password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    if (mode === "signup" && password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    if (mode === "login") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      setLoading(false);

      if (signInError) {
        setError("E-mail ou senha inválidos.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (signUpError) {
      setError(signupErrorMessage(signUpError.message));
      return;
    }

    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setInfo("Conta criada. Se o e-mail de confirmação estiver ativo, abra o link enviado para entrar.");
  }

  const isSignup = mode === "signup";

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl"
    >
      <div className="flex rounded-lg bg-zinc-950 p-1">
        <button
          type="button"
          onClick={() => switchMode("login")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            !isSignup ? "bg-zinc-800 text-zinc-50" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={() => switchMode("signup")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            isSignup ? "bg-zinc-800 text-zinc-50" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Criar conta
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-zinc-300">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500"
          placeholder="voce@email.com"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-zinc-300">
          Senha
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={isSignup ? 6 : undefined}
          autoComplete={isSignup ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500"
          placeholder="••••••••"
        />
      </div>
      {isSignup && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm-password" className="text-sm font-medium text-zinc-300">
            Confirmar senha
          </label>
          <input
            id="confirm-password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500"
            placeholder="••••••••"
          />
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      {info && <p className="text-sm text-emerald-400">{info}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
      >
        {loading
          ? isSignup
            ? "Criando conta..."
            : "Entrando..."
          : isSignup
            ? "Criar conta"
            : "Entrar"}
      </button>
    </form>
  );
}
