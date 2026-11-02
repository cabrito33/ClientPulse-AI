# Relatório de Auditoria Técnica — ClientPulse AI (Fase 0)

**Data da Auditoria:** 2 de Novembro de 2026  
**Repositório:** `cabrito33/ClientPulse-AI` (Público)  
**Branch Auditado:** `feat/onboarding-assistant` (PR #4, que incorpora PR #3)  
**Base:** `origin/main`  
**Objetivo do Projeto:** MVP funcional de ponta a ponta até 17/11/2026 sem reescrever código funcional nem alterar o design visual existente.

---

## 1. Resumo Executivo da Auditoria

O branch `feat/onboarding-assistant` (PR #4) reúne todo o trabalho de backend desenvolvido pela equipa Lima-stack, compreendendo:
- Esquema relacional PostgreSQL e migrações Supabase (`001_initial_schema.sql` e `002_cron_scheduler.sql`).
- Políticas completas de Row Level Security (RLS) para isolamento multi-inquilino.
- 5 Edge Functions nucleares em Deno (`github-sync`, `generate-report`, `approve-and-send`, `client-portal-data`, `dispatch-scheduled-reports`) mais a Edge Function conversacional `onboarding-chat`.
- 5 módulos partilhados em `supabase/functions/_shared/` (`cors`, `supabaseClient`, `github`, `gemini`, `resend`).

### Veredito Global
O backend presente nas PRs #3 e #4 está **estruturalmente sólido e bem arquitetado**, com divisão limpa de responsabilidades e código reutilizável. No entanto, **não está pronto para merge direto em `main`** nem para produção imediata devido a três fatores críticos:
1. **Quebra de Build & Lint no Next.js:** O TypeScript e ESLint da raiz analisam ficheiros Deno de `supabase/functions/`, falhando por falta do tipo global `Deno` e por um erro de `prefer-const`.
2. **Vulnerabilidade de Segurança (PAT em Plaintext):** Os tokens GitHub PAT são armazenados em texto simples na tabela `github_integrations`, violando o critério de aceitação de encriptação em repouso da issue #19 ([BE-05]).
3. **Desconexão Frontend/Backend:** O frontend na branch `main` ainda funciona 100% sobre dados em memória (`src/lib/api.ts` e `src/data/*`). Nenhuma das páginas consome ainda o Supabase ou as Edge Functions.

---

## 2. Estrutura do Sistema & Arquitetura

### 2.1 Componentes Frontend (Next.js 15)
- **Framework:** Next.js 15.5 (App Router), React 19, Tailwind CSS v4, Lucide Icons, Recharts.
- **Rotas Existentes:**
  - `/`: Landing page de marketing (10 secções em PT-PT).
  - `/dashboard`: Visão geral do profissional (KPIs, lista de pendentes/enviados, quadro de sprint, gráficos de velocidade).
  - `/dashboard/reports/[id]`: Ecrã de revisão e aprovação WYSIWYG dos 3 blocos (*O que foi feito*, *Bloqueios*, *Próximos passos*).
  - `/dashboard/clients/[id]`: Ficha de cliente e parametrização de cadência de envio.
  - `/portal/[token]`: Portal do cliente sem login (zero-login read-only com histórico e gráfico de tarefas).
  - `/onboarding`: Assistente de configuração inicial com passos para ligar GitHub e configurar cliente.
- **Camada de Dados Atual:** `src/lib/api.ts` (funções facade assíncronas que lêem de ficheiros em `src/data/`).

### 2.2 Componentes Backend (Supabase Edge Functions & PostgreSQL)
Localizados na pasta `supabase/`:

```
supabase/
├── migrations/
│   ├── 001_initial_schema.sql       # Tabelas, triggers, RLS e seed script
│   └── 002_cron_scheduler.sql       # Extensões pg_cron/pg_net e job horário
└── functions/
    ├── _shared/
    │   ├── cors.ts                  # Headers e preflight OPTIONS para CORS
    │   ├── supabaseClient.ts        # Factories createUserClient (JWT) e createAdminClient (service_role)
    │   ├── github.ts                # Conector GraphQL para GitHub Projects v2 e paginação
    │   ├── gemini.ts                # Cliente Google Gemini (gemini-2.5-flash) com JSON Schema
    │   └── resend.ts                # Motor de email HTML transacional e mock local
    ├── github-sync/index.ts         # Endpoints: test-connection, list-projects, fetch-columns, fetch-board-data
    ├── generate-report/index.ts     # Extrai tarefas dos últimos 7 dias, chama IA e cria draft
    ├── approve-and-send/index.ts    # Valida JWT/ownership, aplica edições, aprova e dispara email
    ├── client-portal-data/index.ts  # Endpoint público token-gated para o Portal do Cliente
    ├── dispatch-scheduled-reports/index.ts # Job disparado pelo cron para envios agendados e bypass
    └── onboarding-chat/index.ts     # Assistente conversacional LLM com deteção e validação de PAT
```

### 2.3 Tabelas da Base de Dados (Esquema vs Backlog)
A migração `001_initial_schema.sql` cria **5 tabelas**, apresentando algumas divergências em relação às 6 tabelas originalmente nomeadas na issue #15 ([BE-01]):

| Tabela Implementada | Propósito | Tabela Prevista na Issue #15 | Análise de Divergência |
| :--- | :--- | :--- | :--- |
| `agencies` | Workspace do utilizador (1:1 com `auth.users(id)`). | `profiles` | Equivalente funcional. Usar `agencies` é semanticamente mais rico para o modelo B2B. |
| `github_integrations` | Armazena PAT e username GitHub da agência. | *(Não explícita em #15, prevista em #19)* | Essencial para a US01. |
| `clients` | Registo de clientes, tom, idioma, projeto GitHub e agendamento. | `clients` | Alinhada. Incorpora a coluna `portal_token UUID` e campos de cron. |
| `reports` | Rascunhos e relatórios aprovados com os 3 blocos em texto e raw JSON. | `reports` | Alinhada. Incorpora `email_delivery_id` para auditoria do envio. |
| `report_tasks` | Tarefas granulares lidas do GitHub associadas a cada relatório. | `sprint_metrics` | Divergência: a tabela agregada `sprint_metrics` não foi criada; os dados são agregados on-the-fly a partir de `report_tasks`. |
| *(Inexistente)* | Tabela dedicada a múltiplos tokens por cliente. | `portal_tokens` | O token é armazenado diretamente como coluna única em `clients.portal_token`. |
| *(Inexistente)* | Tabela de histórico de envios e falhas. | `delivery_logs` | Logs ficam apenas na coluna `reports.email_delivery_id` e na consola das Edge Functions. |

---

## 3. Variáveis de Ambiente & Como Executar o Projeto

### 3.1 Variáveis de Ambiente Requeridas

As variáveis necessárias estão documentadas no template [`.env.example`](file:///c:/Users/Utilizador/Desktop/Faculdade/Projeto%20DAS/.env.example):

| Variável | Escopo | Obrigatória? | Descrição |
| :--- | :--- | :---: | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend & Functions | **Sim** | URL base do projeto Supabase (`https://<ref>.supabase.co` ou `http://127.0.0.1:54321`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend | **Sim** | Chave anónima pública que respeita as regras de RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend (Secrets) | **Sim** | Chave secreta de administração (usada exclusivamente nas Edge Functions). |
| `GEMINI_API_KEY` | Backend (Secrets) | **Sim** | Chave do Google AI Studio para geração de relatórios e assistente. |
| `RESEND_API_KEY` | Backend (Secrets) | Opcional | Chave da Resend. Se omitida, ativa o modo mock/preview para testes locais. |
| `RESEND_FROM_EMAIL` | Backend (Secrets) | Opcional | Remetente (`onboarding@resend.dev` para testes ou domínio verificado). |
| `SCHEDULED_FUNCTION_SECRET` | Backend & pg_cron | **Sim** | Segredo partilhado para proteger a invocação de `dispatch-scheduled-reports`. |
| `NEXT_PUBLIC_APP_URL` | Frontend & Functions | **Sim** | URL base da aplicação web (ex: `http://localhost:3000`), usado nos links de email. |
| `NEXT_PUBLIC_USE_MOCK` | Frontend | Opcional | Flag recomendada para alternar entre dados em memória e Supabase real. |

### 3.2 Como Executar o Projeto Localmente

#### 1. Iniciar o Frontend (Next.js)
```bash
# Instalar dependências
npm install

# Copiar ficheiro de ambiente
cp .env.example .env.local

# Executar servidor de desenvolvimento
npm run dev
# Aplicação disponível em http://localhost:3000
```

#### 2. Iniciar o Supabase Localmente (via Supabase CLI)
```bash
# Iniciar stack local (PostgreSQL, Auth, Storage, Edge Runtime)
supabase start

# Aplicar as migrações da base de dados
supabase db reset

# Definir os segredos locais para as Edge Functions
supabase secrets set GEMINI_API_KEY="a-tua-chave-gemini"
supabase secrets set SCHEDULED_FUNCTION_SECRET="segredo-local-123"
supabase secrets set RESEND_API_KEY="re_teste_opcional"

# Executar as Edge Functions localmente
supabase functions serve
```

---

## 4. Verificação de Merge, Lint e Build

### 4.1 Merge em `main`
- **Resultado:** **MERGE LIMPO (SEM CONFLITOS)**.
- **Verificação Técnica:** O comando `git merge-tree $(git merge-base origin/main HEAD) origin/main HEAD` executou com código de saída 0. As alterações da branch `feat/onboarding-assistant` são estritamente aditivas em `supabase/` e `docs/`, sem colisões com os ficheiros existentes em `src/` na branch `main`.

### 4.2 Verificação de `npm run lint`
- **Resultado:** **FALHOU (1 erro)**.
- **Detalhes do Erro:**
  ```text
  ./supabase/functions/onboarding-chat/index.ts:74:9
  error: 'tokenValidationResult' is never reassigned. Use 'const' instead  prefer-const
  ```
- **Causa:** O ficheiro `supabase/functions/onboarding-chat/index.ts` declarou `let tokenValidationResult = ...` sem posterior reatribuição direta da variável. O ESLint da raiz analisou a pasta `supabase/` e barrou o processo.

### 4.3 Verificação de `npm run build`
- **Resultado:** **FALHOU (Erro de Tipos TypeScript)**.
- **Detalhes do Erro:**
  ```text
  ./supabase/functions/_shared/resend.ts:170:36
  Type error: Cannot find name 'Deno'.
    168 |  */
    169 | export async function sendReportEmail(options: SendReportEmailOptions): Promise<{ id: string; mock: boolean }> {
  > 170 |   const apiKey = options.apiKey || Deno.env.get('RESEND_API_KEY');
        |                                    ^
  ```
- **Causa Raiz:** O ficheiro [tsconfig.json](file:///c:/Users/Utilizador/Desktop/Faculdade/Projeto%20DAS/tsconfig.json#L25) inclui `"**/*.ts"`. Como as Edge Functions do Supabase utilizam o runtime Deno (e não Node.js/DOM), o compilador do Next.js tenta validar `supabase/functions/` e falha porque o objeto global `Deno` não está tipado no ecossistema Next.js.
- **Ação Corretiva para a Fase 1:** Adicionar `"supabase"` aos `exclude` do `tsconfig.json` e aos `ignores` do `eslint.config.mjs` (ou criar uma tipagem ambiente `declare const Deno: any;`).

---

## 5. Checklist de Segurança

| Questão de Segurança | Resposta | Ficheiro e Linha | Diagnóstico & Detalhes |
| :--- | :---: | :--- | :--- |
| **Tokens PAT em `github_integrations` estão cifrados?** | **NÃO** | [supabase/migrations/001_initial_schema.sql#L58](file:///c:/Users/Utilizador/Desktop/Faculdade/Projeto%20DAS/supabase/migrations/001_initial_schema.sql#L58) e [supabase/functions/onboarding-chat/index.ts#L105](file:///c:/Users/Utilizador/Desktop/Faculdade/Projeto%20DAS/supabase/functions/onboarding-chat/index.ts#L105) | A coluna `pat_token` é do tipo `TEXT NOT NULL` simples e o assistente guarda o token diretamente em plaintext (`pat_token: rawToken`). Não há encriptação via `pgcrypto` (`pgp_sym_encrypt`) nem criptografia simétrica na Edge Function. |
| **Há RLS em TODAS as tabelas?** | **SIM** | [supabase/migrations/001_initial_schema.sql#L197-L201](file:///c:/Users/Utilizador/Desktop/Faculdade/Projeto%20DAS/supabase/migrations/001_initial_schema.sql#L197-L201) | RLS ativado explicitamente em `agencies`, `github_integrations`, `clients`, `reports` e `report_tasks`, com políticas `RESTRICTIVE` isolando o acesso por `user_id = auth.uid()`. |
| **`approve-and-send` valida JWT e propriedade do relatório?** | **SIM** | [supabase/functions/approve-and-send/index.ts#L35-L86](file:///c:/Users/Utilizador/Desktop/Faculdade/Projeto%20DAS/supabase/functions/approve-and-send/index.ts#L35-L86) | Extrai o utilizador com `getAuthenticatedUser(req)`. Cria o cliente com `createUserClient(req)` passando o JWT do utilizador. A consulta e mutação estão sujeitas às políticas de RLS da tabela `reports`. |
| **`client-portal-data` valida token e devolve só dados do cliente?** | **PARCIAL** | [supabase/functions/client-portal-data/index.ts#L40-L95](file:///c:/Users/Utilizador/Desktop/Faculdade/Projeto%20DAS/supabase/functions/client-portal-data/index.ts#L40-L95) e [supabase/migrations/001_initial_schema.sql#L93](file:///c:/Users/Utilizador/Desktop/Faculdade/Projeto%20DAS/supabase/migrations/001_initial_schema.sql#L93) | **Valida existência:** Sim (UUIDv4 testado por regex e consultado na BD).<br>**Isolamento:** Sim (apenas reports e tasks onde `client_id = client.id`).<br>**Valida expiração/revogação:** Não. O token na tabela `clients` é permanente; não existe coluna `expires_at` nem tabela de revogação de tokens. |
| **A `service_role` nunca chega ao browser?** | **SIM** | [supabase/functions/_shared/supabaseClient.ts#L45-L58](file:///c:/Users/Utilizador/Desktop/Faculdade/Projeto%20DAS/supabase/functions/_shared/supabaseClient.ts#L45-L58) | `createAdminClient` apenas consome `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` no ambiente das Edge Functions do servidor. Não existe qualquer referência a esta chave no código de `src/`. |
| **CORS razoável?** | **PARCIAL** | [supabase/functions/_shared/cors.ts#L17](file:///c:/Users/Utilizador/Desktop/Faculdade/Projeto%20DAS/supabase/functions/_shared/cors.ts#L17) | Configurado com `'Access-Control-Allow-Origin': '*'`. É aceitável durante o desenvolvimento e para o endpoint público `client-portal-data`, mas em produção endpoints mutáveis autenticados (`approve-and-send`) devem restringir a origem ao domínio da aplicação web. |
| **Nenhum segredo no código ou histórico git?** | **SIM** | Repositório `cabrito33/ClientPulse-AI` | Varrimento profundo realizado em todos os ficheiros e commits: **nenhuma chave privada, token ou credencial real encontrada**. Apenas placeholders padrão (ex: `re_your_resend_api_key`) em `.env.example`. |

---

## 6. Matriz de Critérios de Aceitação das Issues

Avaliação detalhada para cada uma das issues especificadas do repositório `cabrito33/ClientPulse-AI`:

| Issue & ID | Prioridade & Size | Estado | Cumprimento | Justificação & Evidências |
| :--- | :---: | :---: | :---: | :--- |
| **#15 [BE-01]** Schema PostgreSQL no Supabase | P0 / L | In Progress | **PARCIAL** | **Cumprido:** Migrações versionadas em `001_initial_schema.sql` e `002_cron_scheduler.sql`; seed script presente.<br>**Não Cumprido:** Apenas 5 tabelas criadas (`agencies`, `github_integrations`, `clients`, `reports`, `report_tasks`); faltam as tabelas explícitas `sprint_metrics`, `portal_tokens` e `delivery_logs`. Faltam os tipos TypeScript gerados na base de código. |
| **#16 [BE-02]** Row Level Security (multi-inquilino) | P1 / L | To Do | **CUMPRIDO** | Todas as 5 tabelas têm RLS ativado com políticas baseadas em `auth.uid() = agencies.user_id`. O portal acede via Edge Function com token. *(Nota: falta suite formal de testes automatizados com múltiplos utilizadores para validação contínua).* |
| **#19 [BE-05]** Auth GitHub via PAT cifrado | P1 / M | To Do | **PARCIAL** | **Cumprido:** Validação do PAT contra a API do GitHub (`/user`) em `github-sync` e `onboarding-chat`; scopes orientados na documentação.<br>**Não Cumprido:** O token é gravado em plaintext na coluna `pat_token` de `github_integrations` (não está cifrado em repouso). |
| **#20 [BE-06]** Integração GitHub GraphQL (ProjectV2) | P0 / L | In Progress | **CUMPRIDO** | Em `_shared/github.ts`, a query GraphQL extrai itens com título, corpo (descrição), labels, assignees e campo de status de ProjectV2 (para utilizador ou organização); paginação por cursor implementada com loop `while(hasNextPage)`; tratamento robusto de erros HTTP e GraphQL. |
| **#21 [BE-07]** Mapeamento dinâmico de colunas | P1 / M | To Do | **CUMPRIDO (BE) / PARCIAL (End-to-End)** | Na base de dados, a coluna `clients.column_mapping` guarda o JSON com as listas associadas a `done`, `in_progress` e `blocked`. A função `categorizeTaskStatus` em `_shared/github.ts` aplica o mapeamento e ignora colunas não mapeadas. Falta ligar o seletor visual do frontend à API. |
| **#24 [BE-10]** Integração API IA (Gemini) via SDK/REST | P0 / M | To Do | **CUMPRIDO** | Módulo isolado em `_shared/gemini.ts`. Chave lida de `Deno.env.get('GEMINI_API_KEY')`. Trata erros de status, timeout de rede e validação estrutural do retorno. |
| **#25 [BE-11]** Prompt de sistema em PT-PT e anti-alucinação | P0 / M | To Do | **PARCIAL** | **Cumprido:** Prompt versionado em `_shared/gemini.ts` com regras estritas anti-alucinação ("You must ONLY synthesize tasks that are explicitly listed below...").<br>**Não Cumprido:** Não contém o mínimo de 2 exemplos *few-shot* exigido no critério de aceitação; não documentada revisão formal de 3 casos reais. |
| **#26 [BE-12]** Structured Outputs (JSON Schema) | P0 / M | To Do | **CUMPRIDO** | Implementado com `responseMimeType: "application/json"` e `responseSchema` com as propriedades `done`, `blockers`, `next_steps` e `required` explícito. `JSON.parse` validado em runtime com rejeição de respostas parciais. |
| **#27 [BE-13]** Parametrização dinâmica de tom e idioma | P2 / S | To Do | **PARCIAL** | **Cumprido:** Parâmetros `communication_tone` (`formal`, `executive`, `casual`) e `language` (`pt`, `en`) lidos de `clients` e injetados dinamicamente no system prompt.<br>**Não Cumprido:** Falta teste automatizado cobrindo as 6 combinações possíveis. |
| **#28 [BE-14]** Fallback gracioso quando a IA falha | P2 / M | To Do | **NÃO CUMPRIDO** | Em `generate-report/index.ts`, se o Gemini falhar, a função lança um erro HTTP 500. Não guarda um relatório em estado `fallback` com os cartões em bruto, nem regista a falha numa tabela `delivery_logs`. |
| **#29 [BE-15]** Cron Job semanal (dia/hora) | P1 / L | To Do | **CUMPRIDO** | Tabela `clients` possui `schedule_day_of_week` e `schedule_hour_utc`. `002_cron_scheduler.sql` configura o agendamento `0 * * * *` chamando `dispatch-scheduled-reports`. A função filtra exatamente os clientes cuja hora e dia correspondem ao momento atual e protege o endpoint com `SCHEDULED_FUNCTION_SECRET`. |
| **#30 [BE-16]** Lógica de bypass (auto vs revisão) | P1 / M | To Do | **CUMPRIDO** | Implementado em `dispatch-scheduled-reports/index.ts`: se `client.auto_send_enabled = false`, cria relatório com `status: 'draft'`; se `true`, dispara imediatamente o envio via `sendReportEmail` e grava `status: 'sent'`. |
| **#32 [BE-18]** Integração email transacional (Resend) | P0 / M | To Do | **PARCIAL** | **Cumprido:** Implementado em `_shared/resend.ts` via API REST com fallback de modo mock para desenvolvimento/testes locais sem domínio verificado; remetente configurável via `RESEND_FROM_EMAIL`.<br>**Não Cumprido:** O ID da mensagem é guardado em `reports.email_delivery_id`, mas não na tabela `delivery_logs` (que não existe). |
| **#33 [BE-19]** Magic Links com tokens UUIDv4 | P1 / M | To Do | **PARCIAL** | **Cumprido:** Token UUIDv4 não adivinhável gerado por omissão (`gen_random_uuid()`).<br>**Não Cumprido:** O token é perpétuo na tabela `clients`; não existe suporte para expiração configurável nem histórico de revogação. |
| **#34 [BE-20]** Template HTML responsivo de email | P1 / M | To Do | **CUMPRIDO** | Função `buildReportEmailHtml` em `_shared/resend.ts` gera HTML inline com tabelas para compatibilidade total com Gmail e Outlook, estruturando os 3 blocos com badges coloridos e botão CTA para o portal do cliente. |
| **#43 [BE-24]** Listar GitHub Projects e selecionar board | P1 / M | To Do | **CUMPRIDO** | Em `github-sync/index.ts`, a ação `list-projects` suporta utilizadores e organizações, retornando lista de ProjectV2 com mensagens claras de erro ou ausência de permissões. |
| **#45 [BE-25]** Calcular e guardar sprint_metrics | P1 / M | To Do | **PARCIAL** | **Cumprido:** Tarefas concluídas e estados são persistidos em `report_tasks` e agregados em `client-portal-data`.<br>**Não Cumprido:** A tabela `sprint_metrics` não foi criada no esquema SQL; o frontend ainda consome dados simulados de `src/data/metrics.ts`. |
| **#46 [BE-26]** API para aprovar e enviar rascunhos | P1 / M | To Do | **CUMPRIDO** | Edge Function `approve-and-send/index.ts` permite atualizar os 3 blocos, valida ownership com RLS, altera estado para `'sent'` e despacha o email via Resend. |
| **#47 [BE-27]** Chatbot de onboarding e FAQ | P1 / L | Backlog | **CUMPRIDO (BE)** | Edge Function `onboarding-chat/index.ts` possui instruções detalhadas com contexto da documentação do produto e FAQs, deteção automática de PAT com regex e teste em tempo real com retorno de `action_detected`. *(Nota: classificado formalmente como evolução futura no PRD, mas com backend já desenvolvido no PR #4).* |

---

## 7. Recomendações e Plano Prioritário para a Fase 1

Para avançar com a **Fase 1 (Integração)** de forma segura e progressiva, recomenda-se a seguinte ordem de execução:

1. **Bloco A (Segurança & Correção do Build/Lint):**
   - Configurar `tsconfig.json` e `eslint.config.mjs` para isolar a pasta `supabase/functions/` da compilação do Next.js, corrigindo o erro `prefer-const` em `onboarding-chat/index.ts`.
   - Adicionar mecanismo de encriptação em repouso para o campo `github_integrations.pat_token` (ou cifragem simétrica com segredo via Edge Function / `pgcrypto`).
   - Adicionar suporte a expiração opcional de token no portal ou mecanismo explícito de revogação.
2. **Bloco B (BE-23 / #42 — Autenticação Supabase):**
   - Instalar `@supabase/ssr` e configurar middleware de proteção para `/dashboard/**` e `/onboarding`.
   - Criar páginas `/login` e `/register` em PT-PT mantendo compatibilidade com `NEXT_PUBLIC_USE_MOCK=true`.
3. **Bloco C (BE-03 / #17 — Migração de `src/lib/api.ts`):**
   - Substituir as leituras locais de `src/data/*` por chamadas ao cliente Supabase e às Edge Functions, preservando 100% das assinaturas e tipos para não afetar o design.
4. **Bloco D & E (BE-25 / #45 e FE-09 / #48 — Gráficos Reais e Chatbot):**
   - Ligar os gráficos de velocidade aos dados de `report_tasks` / `client-portal-data`.
   - Ligar o componente `/onboarding` à Edge Function `onboarding-chat`.
5. **Bloco F & G (Documentação e Testes):**
   - Atualizar README oficial, criar `.github/pull_request_template.md` e implementar testes com Vitest.

---
*Relatório de Auditoria concluído. Aguarda aprovação do utilizador para iniciar a Fase 1.*
