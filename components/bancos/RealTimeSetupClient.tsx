"use client";

import Link from "next/link";
import { useState } from "react";
import { PageShell, SectionLabel, SoftPanel } from "@/components/ui/page-chrome";
import { formatCurrency } from "@/lib/finance/format";

const BODY_TEMPLATE = '{"app":"NOME DO APP","title":"TÍTULO DA NOTIFICAÇÃO","text":"TEXTO DA NOTIFICAÇÃO"}';

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

/**
 * "Saldo em tempo real" sem custo: o celular encaminha ao app as
 * notificações dos apps dos bancos (MacroDroid no Android, grátis; Atalhos
 * no iPhone, já instalado). O app registra a movimentação na hora como
 * provisória e troca pela oficial quando a Pluggy atualizar.
 */
export default function RealTimeSetupClient({ endpoint, initialToken }: { endpoint: string; initialToken: string | null }) {
  const [token, setToken] = useState(initialToken);
  const [busy, setBusy] = useState<"rotate" | "test" | null>(null);
  const [testText, setTestText] = useState("Compra de R$ 45,90 APROVADA em IFOOD *RESTAURANTE para o cartão com final 1062.");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
            ao app as notificações dos apps dos bancos. É <strong className="text-zinc-200">grátis</strong>: usa o
            MacroDroid (Android) ou o Atalhos (iPhone). Cada movimentação entra como provisória e é trocada pela oficial
            quando o banco atualizar — sem duplicar.
          </p>
        </div>

        <SoftPanel className="flex flex-col gap-3 p-4">
          <SectionLabel>Seu link pessoal</SectionLabel>
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
                Não compartilhe este link: quem tiver ele consegue lançar movimentações na sua conta. Se vazar, gere um
                novo.
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

        <SoftPanel className="flex flex-col gap-3 p-4">
          <SectionLabel>Android — MacroDroid (grátis)</SectionLabel>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
            <li>
              Instale o <strong>MacroDroid</strong> na Play Store. A versão grátis permite 5 automações; esta usa só 1.
            </li>
            <li>
              Toque em <strong>Adicionar macro</strong>. Em <strong>Gatilho</strong>, escolha <strong>Notificação</strong>{" "}
              → <strong>Notificação recebida</strong>, selecione os apps dos seus bancos (Nubank, Inter, Caixa, Bradesco,
              Santander…) e permita o acesso às notificações quando o celular pedir.
            </li>
            <li>
              Em <strong>Ação</strong>, escolha <strong>Web/Conectividade</strong> → <strong>Requisição HTTP</strong>:
              método <strong>POST</strong>, cole o <strong>link pessoal</strong> acima e, no corpo (tipo JSON), cole o
              modelo abaixo. Troque cada parte em MAIÚSCULAS pelo item correspondente do botão de{" "}
              <strong>texto mágico</strong> (o “…”): nome do app, título da notificação e texto da notificação.
            </li>
            <li>Salve a macro e, nas configurações do Android, tire o MacroDroid da economia de bateria.</li>
            <li>Teste: faça um Pix de R$ 0,01 ou uma compra pequena — em segundos ela aparece no extrato do app.</li>
          </ol>
          <code className="block break-all rounded-xl bg-zinc-950/70 p-3 text-xs text-zinc-200">{BODY_TEMPLATE}</code>
          <div>
            <CopyButton value={BODY_TEMPLATE} label="Copiar modelo do corpo" />
          </div>
        </SoftPanel>

        <SoftPanel className="flex flex-col gap-3 p-4">
          <SectionLabel>iPhone — Atalhos (já vem instalado)</SectionLabel>
          <p className="text-sm leading-relaxed text-zinc-400">
            O iPhone não deixa ler notificações de outros apps, mas funciona com os <strong>SMS</strong> que o banco manda
            a cada compra (ative os avisos por SMS no app do banco, se ele oferecer de graça).
          </p>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
            <li>
              No app <strong>Atalhos</strong> → <strong>Automação</strong> → <strong>Nova automação</strong> →{" "}
              <strong>Mensagem</strong>: remetente = número do banco, “mensagem contém” = <strong>R$</strong>, e marque{" "}
              <strong>Executar imediatamente</strong>.
            </li>
            <li>
              Ação <strong>Obter conteúdo do URL</strong>: cole o link pessoal, método <strong>POST</strong>, corpo{" "}
              <strong>JSON</strong> com o campo <strong>text</strong> = Conteúdo da mensagem e o campo{" "}
              <strong>app</strong> = nome do banco (ex.: Bradesco).
            </li>
          </ol>
        </SoftPanel>

        <SoftPanel className="flex flex-col gap-3 p-4">
          <SectionLabel>Testar a leitura</SectionLabel>
          <p className="text-sm text-zinc-400">
            Cole o texto de uma notificação do seu banco para ver como o app entende. O teste não grava nada.
          </p>
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
