# 💰 Meu Financeiro IA

Painel financeiro pessoal com quatro abas:

- **🤖 Conversa com IA** — conte suas movimentações em linguagem natural e a IA registra tudo.
- **📊 Dashboard** — visão geral com cards e gráficos (Recharts).
- **📋 Detalhes** — extrato completo com filtros e edição manual dos lançamentos.
- **🏦 Bancos** — conecte bancos reais via Open Finance (Pluggy) para importar saldo e extrato.

Stack: **Next.js 16** (App Router, TypeScript, Tailwind CSS) + **Supabase** (Postgres + Auth) + **Google Gemini** + **Pluggy**.

## 1. Pré-requisitos

- Node.js 20+
- Uma conta no [Supabase](https://supabase.com) (gratuita)
- Uma chave de API do [Google AI Studio](https://aistudio.google.com/apikey) (camada gratuita do Gemini, sem cartão de crédito)
- Uma conta na [Pluggy](https://dashboard.pluggy.ai) (Client ID e Client Secret) para conectar bancos

## 2. Criar o projeto no Supabase

1. Crie um novo projeto em [supabase.com](https://supabase.com/dashboard).
2. Vá em **SQL Editor** e execute as migrations em [`supabase/migrations/`](supabase/migrations/) (na ordem: `0001_init.sql`, `0002_bank_connections.sql`, `0003_cards_bank_connection.sql`). Isso cria as tabelas, os índices, as políticas de segurança (RLS) e um gatilho que cria automaticamente uma conta e um cartão padrão para qualquer usuário novo.
3. Em **Authentication > Providers**, deixe o provedor **Email** habilitado. Novos usuários se cadastram pela própria tela de login do app. Cada conta fica isolada das outras (RLS).
4. Em **Project Settings > API**, copie a **Project URL** e a **anon public key**.

## 3. Configurar variáveis de ambiente

Copie o arquivo de exemplo e preencha com suas chaves:

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key-aqui
GEMINI_API_KEY=sua-chave-gemini-aqui
PLUGGY_CLIENT_ID=seu-client-id
PLUGGY_CLIENT_SECRET=seu-client-secret
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

## 4. Rodar localmente

```bash
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000), faça login com o usuário criado no passo 2, e comece a conversar com a IA.

## 5. Como usar

Na aba **Conversa com IA**, escreva normalmente, por exemplo:

- "Recebi 2800 de salário hoje."
- "Gastei 45 no mercado e 30 de combustível."
- "Minha fatura está em 850."
- "Tenho que pagar 350 da faculdade todo dia 10."
- "Devo 500 para meu irmão."
- "Quanto posso gastar até o fim do mês?"

A IA usa ferramentas (function calling) para registrar entradas, saídas, saldos, faturas, recorrências e dívidas diretamente no Supabase, e consulta seus dados reais para responder perguntas.

O **Dashboard** e a aba **Detalhes** refletem esses dados em tempo real.

## Estrutura do projeto

```
app/
  login/page.tsx            # tela de login (Supabase Auth)
  (app)/                    # rotas protegidas (layout com as 4 abas)
    chat/page.tsx
    dashboard/page.tsx
    detalhes/page.tsx
    bancos/page.tsx
  api/
    chat/route.ts            # loop de tool-use com Gemini
    bank/                    # conexão, sync e webhook da Pluggy
    transactions/route.ts    # listagem/filtros usados na aba Detalhes
    transactions/[id]/route.ts
lib/
  supabase/                  # clientes Supabase (browser, server, middleware)
  ai/                        # cliente Gemini, prompt e definição das tools
  finance/                   # tipos, categorias, formatação e cálculo do snapshot financeiro
  pluggy/                    # cliente e sincronização Open Finance
components/
  chat/ dashboard/ detalhes/ bancos/ auth/ nav/
supabase/migrations/
```

## 6. Deploy no Render

O repositório já inclui um [`render.yaml`](render.yaml) (Blueprint), então o Render detecta e configura o serviço automaticamente:

1. Acesse [dashboard.render.com](https://dashboard.render.com) e conecte sua conta do GitHub (autorize o acesso ao repositório `Meu-Financeiro-IA`).
2. Clique em **New +** → **Blueprint**, selecione o repositório e a branch `main`.
3. O Render vai ler o `render.yaml` e propor a criação do serviço `meu-financeiro-ia` (plano **Free**, runtime Node).
4. Antes de confirmar, preencha as variáveis de ambiente marcadas como secretas:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY`
   - `PLUGGY_CLIENT_ID`
   - `PLUGGY_CLIENT_SECRET`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Clique em **Apply** / **Create Web Service**. O build roda `npm ci && npm run build` e o start é `npm start`.
6. Após o primeiro deploy (alguns minutos), a URL pública (algo como `https://meu-financeiro-ia.onrender.com`) fica disponível na aba do serviço.

Observações do plano gratuito do Render: o serviço "dorme" depois de 15 minutos sem tráfego e demora ~1 minuto para acordar na próxima requisição — normal para uso pessoal, sem custo.

Cada novo `git push` na branch `main` gera um novo deploy automático.

## Notas e limitações da v1

- Editar ou excluir um lançamento na aba Detalhes corrige o registro em si, mas **não** reajusta automaticamente o saldo da conta/fatura que já foi alterado no momento da criação.
- Sem Open Finance nativo do BACEN — a conexão com bancos reais passa pela Pluggy (leitura de saldo e extrato). Atualizações automáticas dependem do ciclo do banco/Pluggy (não são no segundo da compra).
- Sem planos e sem pagamentos — cada pessoa cria a própria conta na tela de login e vê só os seus dados.

## Próximos passos

1. Validar as conexões bancárias reais no ambiente da Pluggy (produção vs sandbox).
