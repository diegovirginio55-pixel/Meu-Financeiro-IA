import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-2 text-4xl">💰</div>
          <h1 className="text-2xl font-semibold text-zinc-50">
            Meu Financeiro IA
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Acesso restrito e pessoal
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
