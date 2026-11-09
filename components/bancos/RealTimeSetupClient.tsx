"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { PageShell, SectionLabel, SoftPanel } from "@/components/ui/page-chrome";
import { formatCurrency } from "@/lib/finance/format";
import { formatRelativeDaySP } from "@/lib/ui/datetime";
import type { IngestLogEntry } from "@/lib/ingest/log";

/** Corpo do MacroDroid: os textos entre colchetes são trocados pelo MacroDroid ("texto mágico"). */
const ANDROID_BODY = '{"app":"[app_name]","title":"[notification_title]","text":"[notification]"}';

type TestResult =
  | { ok: true; ignored: string }
  | { ok: true; test: true; wouldRegister: { description: string; amount: number; type: string; category: string; bank: string | null } }
  | { error: string };

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
      className="shrink-0 rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
    >
      {copied ? "Copiado ✓" : label}
    </button>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-semibold text-emerald-300">
        {n}
      </span>
      <div className="min-w-0 text-sm leading-relaxed text-zinc-300">{children}</div>
    </li>
  );
}

function Field({ name, value }: { name: string; value: React.ReactNode }) {
  return (
    <div className="mt-1 rounded-lg bg-zinc-950/70 px-3 py-1.5 text-xs">
      <span className="text-zinc-500">{name}: </span>
      <span className="text-zinc-200">{value}</span>
    </div>
  );
}

const RESULT_STYLE: Record<IngestLogEntry["result"], string> = {
  registrado: "text-emerald-300",
  duplicado: "text-zinc-400",
  ignorado: "text-amber-300",
  teste: "text-zinc-400",
};

/**
 * "Saldo em tempo real" sem custo: o celular encaminha ao app as
 * notificações dos apps dos bancos (MacroDroid no Android, grátis; Atalhos
 * no iPhone, já instalado). O app registra a movimentação na hora como
 * provisória e troca pela oficial quando a Pluggy atualizar.
 */
export default function RealTimeSetupClient({
  endpoint,
  initialToken,
  log,
}: {
  endpoint: string;
  initialToken: string | null;
  log: IngestLogEntry[];
}) {
  const router = useRouter();
  const [platform, setPlatform] = useState<"android" | "iphone">("android");
  const [token, setToken] = useState(initialToken);
  const [busy, setBusy] = useState<"rotate" | "test" | null>(null);
  const [testText, setTestText] = useState("Compra de R$ 45,90 APROVADA em IFOOD *RESTAURANTE para o cartão com final 1062.");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();

  // A lista de notificações recebidas se atualiza sozinha enquanto a tela está aberta.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") startRefresh(() => router.refresh());
    }, 10_000);
    return () => window.clearInterval(id);
  }, [router]);

  const url = token ? `${endpoint}?token=${token}` : "";

  async function rotate() {
    if (!confirm("Gerar um link novo? O link antigo para de funcionar e você precisará colar o novo no celular.")) return;
    setBusy("rotate");
    setError(null);
    try {
      const res = await fetch("/api/ingest/token", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
      if (!res.ok || !data.token) throw new Error(data.error || "Não foi possível gerar um link novo.");
      setToken(data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gerar um link novo.");
    } finally {
      setBusy(null);
    }
  }

  async function runTest() {
    if (!url) return;
    setBusy("test");
    setTestResult(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app: "Nubank", title: "Teste", text: testText, test: true }),
      });
      setTestResult((await res.json().catch(() => ({ error: "Resposta inválida." }))) as TestResult);
    } catch {
      setTestResult({ error: "Sem conexão com o servidor." });
    } finally {
      setBusy(null);
    }
  }

  const tabClass = (active: boolean) =>
    `flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
      active ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-zinc-200"
    }`;

  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-2 lg:px-6">
        <div>
          <Link href="/bancos" className="text-xs text-zinc-500 hover:text-zinc-300">
            ‹ Bancos
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-white">Saldo em tempo real</h1>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">
            O Meu Pluggy só traz dados novos 1 vez por dia. Para ver cada compra e Pix na hora, o seu celular encaminha
            ao app os avisos dos bancos. É <strong className="text-zinc-200">grátis</strong>. Cada movimentação entra como
            provisória e é trocada pela oficial quando o banco atualizar — sem duplicar.
          </p>
        </div>

        <SoftPanel className="flex flex-col gap-3 p-4">
          <SectionLabel>1. Seu link pessoal</SectionLabel>
          {token ? (
            <>
              <code className="block break-all rounded-xl bg-zinc-950/70 p-3 text-xs text-emerald-200">{url}</code>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={url} label="Copiar link" />
                <button
                  type="button"
                  onClick={rotate}
                  disabled={busy != null}
                  className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 disabled:opacity-50"
                >
                  {busy === "rotate" ? "Gerando…" : "Gerar link novo"}
                </button>
              </div>
              <p className="text-xs text-zinc-500">
                Dica: abra esta página no próprio celular para copiar e colar direto no MacroDroid / Atalhos. Não
                compartilhe o link — se vazar, gere um novo.
              </p>
            </>
          ) : (
            <p className="text-sm text-amber-300">Não foi possível gerar o seu link agora. Recarregue a página.</p>
          )}
          {error && (
            <p role="alert" className="text-sm text-rose-400">
              {error}
            </p>
          )}
        </SoftPanel>

        <div className="flex gap-1 rounded-full border border-zinc-800 bg-zinc-900/60 p-1" role="tablist" aria-label="Celular">
          <button type="button" role="tab" aria-selected={platform === "android"} onClick={() => setPlatform("android")} className={tabClass(platform === "android")}>
            Android
          </button>
          <button type="button" role="tab" aria-selected={platform === "iphone"} onClick={() => setPlatform("iphone")} className={tabClass(platform === "iphone")}>
            iPhone
          </button>
        </div>

        {platform === "android" ? (
          <SoftPanel className="flex flex-col gap-4 p-4">
            <SectionLabel>2. Android — MacroDroid (grátis)</SectionLabel>
            <ol className="flex flex-col gap-4">
              <Step n={1}>
                Instale o <strong>MacroDroid</strong> pela Play Store e abra. A versão grátis permite 5 automações; esta
                usa só 1.
              </Step>
              <Step n={2}>
                Toque em <strong>Adicionar macro</strong> (+). Dê o nome <em>Meu Financeiro</em>.
              </Step>
              <Step n={3}>
                Em <strong>Gatilhos</strong> (+), toque na <strong>lupa 🔍</strong> e digite <strong>notifica</strong> →
                escolha <strong>Notificação</strong> (em muitas versões fica dentro de <strong>Aplicativos</strong>) →{" "}
                <strong>Notificação recebida</strong> → <strong>Selecionar aplicativos</strong>: marque os apps dos seus
                bancos (Nubank, Inter, Caixa, Bradesco, Santander…) e escolha <strong>Qualquer conteúdo</strong>. Quando o
                celular pedir, <strong>permita o acesso às notificações</strong> para o MacroDroid.
              </Step>
              <Step n={4}>
                Em <strong>Ações</strong> (+) → <strong>Conectividade</strong> → <strong>Requisição HTTP</strong> (HTTP
                Request) e preencha:
                <Field name="Método" value="POST" />
                <Field name="URL" value="o seu link pessoal (passo 1)" />
                <Field name="Corpo / Conteúdo" value="tipo application/json, com o texto abaixo" />
                <code className="mt-2 block break-all rounded-lg bg-zinc-950/70 p-2 text-xs text-zinc-200">{ANDROID_BODY}</code>
                <div className="mt-2">
                  <CopyButton value={ANDROID_BODY} label="Copiar corpo" />
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Os textos entre colchetes são o “texto mágico” do MacroDroid (nome do app, título e texto da
                  notificação). Se a sua versão usar outros nomes, troque-os pelo botão <strong>…</strong> do campo.
                </p>
              </Step>
              <Step n={5}>
                Salve a macro (✓). Depois, nas configurações do Android → Apps → MacroDroid → Bateria, escolha{" "}
                <strong>Sem restrições</strong> — senão o Android pode pausar a automação.
              </Step>
              <Step n={6}>
                Teste: no MacroDroid, abra a macro → <strong>⋮</strong> → <strong>Testar ações</strong>. Volte aqui: em
                alguns segundos aparece uma linha nova na lista abaixo (como é um teste sem notificação de verdade, ela
                vem como “ignorado — teste sem notificação real” — isso confirma que a conexão funciona). Depois, uma
                compra ou Pix real aparece como <strong>registrado</strong>.
              </Step>
            </ol>
          </SoftPanel>
        ) : (
          <SoftPanel className="flex flex-col gap-4 p-4">
            <SectionLabel>2. iPhone — Atalhos (já vem instalado)</SectionLabel>
            <p className="text-sm leading-relaxed text-zinc-400">
              O iPhone não deixa outro app ler as notificações dos bancos. Há dois caminhos que funcionam — use um ou os
              dois:
            </p>

            <div className="rounded-xl border border-zinc-800 p-3">
              <p className="text-sm font-semibold text-white">A) Compras com Apple Pay (recomendado)</p>
              <ol className="mt-3 flex flex-col gap-4">
                <Step n={1}>
                  Abra o app <strong>Atalhos</strong> → aba <strong>Automação</strong> → <strong>+</strong> →{" "}
                  <strong>Transação</strong>. Escolha os cartões da Carteira e marque <strong>Executar imediatamente</strong>.
                </Step>
                <Step n={2}>
                  Toque em <strong>Nova automação em branco</strong> → adicione a ação <strong>Obter conteúdo do URL</strong>.
                  Em URL, cole o seu link pessoal.
                </Step>
                <Step n={3}>
                  Toque na seta da ação e configure:
                  <Field name="Método" value="POST" />
                  <Field name="Corpo da solicitação" value="JSON" />
                  <Field name="Campo app (Texto)" value={<>variável <strong>Cartão</strong></>} />
                  <Field name="Campo title (Texto)" value="Compra aprovada" />
                  <Field
                    name="Campo text (Texto)"
                    value={
                      <>
                        Compra no cartão de R$ <strong>Valor</strong> em <strong>Comerciante</strong>
                      </>
                    }
                  />
                  <p className="mt-2 text-xs text-zinc-500">
                    “Cartão”, “Valor” e “Comerciante” são variáveis: toque no campo e escolha na barra acima do teclado.
                  </p>
                </Step>
              </ol>
            </div>

            <div className="rounded-xl border border-zinc-800 p-3">
              <p className="text-sm font-semibold text-white">B) SMS do banco (compras no cartão físico, Pix)</p>
              <p className="mt-1 text-xs text-zinc-500">Funciona se o seu banco manda SMS a cada movimentação.</p>
              <ol className="mt-3 flex flex-col gap-4">
                <Step n={1}>
                  <strong>Atalhos</strong> → <strong>Automação</strong> → <strong>+</strong> → <strong>Mensagem</strong>.
                  Em “Mensagem contém”, escreva <strong>R$</strong>; em “Remetente”, escolha o número do banco. Marque{" "}
                  <strong>Executar imediatamente</strong>.
                </Step>
                <Step n={2}>
                  Ação <strong>Obter conteúdo do URL</strong> com o seu link pessoal, método <strong>POST</strong>, corpo{" "}
                  <strong>JSON</strong>:
                  <Field name="Campo app (Texto)" value="o nome do banco, ex.: Bradesco" />
                  <Field name="Campo text (Texto)" value={<>variável <strong>Mensagem</strong> (conteúdo)</>} />
                </Step>
              </ol>
            </div>

            <p className="text-xs text-zinc-500">
              Para testar, toque no botão ▶ da automação ou faça uma compra pequena e veja a lista abaixo.
            </p>
          </SoftPanel>
        )}

        <SoftPanel className="flex flex-col gap-3 p-4">
          <SectionLabel
            action={
              <button
                type="button"
                onClick={() => startRefresh(() => router.refresh())}
                disabled={refreshing}
                className="text-xs text-emerald-300 hover:underline disabled:opacity-60"
              >
                {refreshing ? "Atualizando…" : "Atualizar"}
              </button>
            }
          >
            3. Últimas notificações recebidas
          </SectionLabel>
          {log.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Nenhuma ainda. Depois de configurar o celular, faça o teste — a lista se atualiza sozinha a cada 10 s.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {log.map((entry) => (
                <li key={`${entry.at}-${entry.preview}`} className="rounded-xl bg-zinc-950/60 p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`font-semibold ${RESULT_STYLE[entry.result]}`}>{entry.result}</span>
                    <span className="text-zinc-500">{formatRelativeDaySP(entry.at)}</span>
                  </div>
                  <p className="mt-1 text-zinc-300">{entry.detail}</p>
                  {entry.preview && <p className="mt-1 truncate text-zinc-500">“{entry.preview}”</p>}
                  {entry.app && <p className="mt-0.5 text-zinc-600">app: {entry.app}</p>}
                </li>
              ))}
            </ul>
          )}
        </SoftPanel>

        <SoftPanel className="flex flex-col gap-3 p-4">
          <SectionLabel>Testar a leitura (sem gravar)</SectionLabel>
          <p className="text-sm text-zinc-400">Cole o texto de uma notificação do seu banco para ver como o app entende.</p>
          <textarea
            value={testText}
            onChange={(event) => setTestText(event.target.value)}
            rows={3}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-100 outline-none focus:border-emerald-600"
          />
          <div>
            <button
              type="button"
              onClick={runTest}
              disabled={busy != null || !token}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy === "test" ? "Testando…" : "Testar"}
            </button>
          </div>
          {testResult && (
            <p role="status" className="text-sm text-zinc-200">
              {"error" in testResult
                ? `Erro: ${testResult.error}`
                : "ignored" in testResult
                  ? `Seria ignorada: ${testResult.ignored}.`
                  : `Seria registrada: ${testResult.wouldRegister.type === "entrada" ? "entrada" : "saída"} de ${formatCurrency(
                      testResult.wouldRegister.amount,
                    )} · "${testResult.wouldRegister.description}" · ${testResult.wouldRegister.category}${
                      testResult.wouldRegister.bank ? ` · ${testResult.wouldRegister.bank}` : ""
                    }`}
            </p>
          )}
        </SoftPanel>
      </div>
    </PageShell>
  );
}
