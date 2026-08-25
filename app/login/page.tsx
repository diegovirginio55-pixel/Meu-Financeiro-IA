import LoginForm from "@/components/auth/LoginForm";
import { InstallAppButton } from "@/components/pwa/PwaInstall";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-4">
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="absolute right-3 top-3 lg:right-6 lg:top-6">
        <ThemeToggle />
      </div>
      <div className="relative w-full max-w-md">
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-emerald-400/90">Meu Financeiro</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white lg:text-5xl">
          Seu dinheiro,
          <br />
          em um só lugar.
        </h1>
        <p className="mt-3 text-sm text-zinc-500">Acesso pessoal</p>
        <div className="mt-8">
          <LoginForm />
        </div>
        <InstallAppButton />
      </div>
    </div>
  );
}
