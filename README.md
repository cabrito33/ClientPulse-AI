# ClientPulse AI

Relatórios semanais de progresso para clientes, gerados com IA a partir do **GitHub Projects**.

Projeto desenvolvido no âmbito da unidade curricular de **Desenvolvimento de Software Ágil** (TDA/TDSA ISCTE Sintra, 2026/27).

**Link:** https://weekly-client-reports.vercel.app
**Repositório:** https://github.com/cabrito33/ClientPulse-AI
**Equipa:** Afonso Pedro, Ricardo Santos, Manel Homem e Miguel Lima (ver [Equipa](#equipa))

---

## O problema

Freelancers e pequenas agências (2 a 10 pessoas) gastam horas todas as semanas a compilar o estado das tarefas, a traduzir linguagem técnica para linguagem de negócio e a responder a clientes que querem saber "em que ponto estamos?". É tempo não faturável, e muitas vezes o cliente continua com dúvidas.

## A solução

O ClientPulse AI liga-se ao GitHub Projects do profissional, extrai as tarefas concluídas, os bloqueios e os próximos passos da semana, e usa IA para redigir um relatório claro, sem jargão técnico. O profissional revê e aprova o rascunho (ou ativa o envio automático). O cliente recebe um e-mail com o resumo e um link seguro para um **Portal do Cliente** só de leitura, sem necessidade de criar conta.

### Funcionalidades do MVP

- **Integração com GitHub Projects** (única fonte de dados no MVP): leitura de issues, estados, labels e responsáveis.
- **Relatório gerado por IA** em 3 blocos: *O que foi feito*, *Bloqueios / Atenção* e *Próximos passos*, com um rascunho em bruto se a IA estiver indisponível.
- **Fluxo de aprovação:** edição do rascunho e "Aprovar e Enviar", ou envio automático opcional.
- **Envio agendado por e-mail**, configurável por cliente (dia e hora, em UTC).
- **Portal do Cliente sem login** (`/portal/[token]`): relatório da semana, histórico e gráfico de tarefas concluídas por sprint.
- **Dashboard do profissional:** relatórios pendentes e enviados, estado dos clientes, métricas por sprint e métricas de sucesso.
- **Assistente de onboarding (PulseBot)** para guiar a ligação ao GitHub e a criação do primeiro cliente.

### Fora do âmbito do MVP

Integrações com Trello, Notion e Jira, aprovações formais por parte do cliente no portal, autenticação do cliente final com credenciais e assistente por voz.

---

## Stack

| Camada | Tecnologia |
| :--- | :--- |
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Recharts |
| Backend | Supabase (PostgreSQL, Auth, Row Level Security, Edge Functions em Deno, pg_cron) |
| IA | Google Gemini API |
| E-mail | Resend |
| Deploy | Vercel |

## Arquitetura (resumo)

- O **frontend** acede aos dados através de uma camada única, `src/lib/api.ts`, e às Edge Functions através de `src/lib/edge.ts`.
- As **Edge Functions** (`supabase/functions/`) fazem a sincronização com o GitHub, a geração dos relatórios, a aprovação e envio, o agendamento e o assistente de onboarding.
- O **isolamento entre utilizadores** é garantido por Row Level Security. O Portal do Cliente acede aos dados através de uma função SQL segura que exige um token único, com expiração e revogação.
- O sistema processa **apenas metadados** das tarefas (título, descrição, estado, responsáveis, labels). O código-fonte dos repositórios nunca é lido nem guardado.

Documentação detalhada na pasta [`docs/`](./docs):

| Ficheiro | Conteúdo |
| :--- | :--- |
| [`PRD.md`](./docs/PRD.md) | Product Requirements Document |
| [`RELATORIO_VALIDACAO.md`](./docs/RELATORIO_VALIDACAO.md) | Validação de mercado |
| [`ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Arquitetura e decisões técnicas |
| [`DATABASE.md`](./docs/DATABASE.md) | Esquema da base de dados |
| [`API.md`](./docs/API.md) | Edge Functions e contratos |
| [`AUDITORIA.md`](./docs/AUDITORIA.md) | Auditoria técnica |
| [`PRIVACY.md`](./docs/PRIVACY.md) | Aviso de privacidade e minimização de dados |
| [`TESTE_REAL.md`](./docs/TESTE_REAL.md) | Roteiro do teste real com a equipa |
| [`RESULTADOS.md`](./docs/RESULTADOS.md) | Métricas de sucesso do PRD |
| [`DEMO.md`](./docs/DEMO.md) | Roteiro da demonstração de 5 minutos |

---

## Como correr o projeto localmente

### Pré-requisitos

- Node.js 22 ou superior
- Conta no [Supabase](https://supabase.com) e [Supabase CLI](https://supabase.com/docs/guides/cli)
- Chave da [Google AI Studio](https://aistudio.google.com/) (Gemini)
- (Opcional) Chave da [Resend](https://resend.com). Sem ela, o envio de e-mail funciona em modo de pré-visualização.

### 1. Instalar e configurar

```bash
git clone https://github.com/cabrito33/ClientPulse-AI.git
cd ClientPulse-AI
npm install
cp .env.example .env.local
```

Preenche o `.env.local` com os teus valores. **Nunca faças commit de ficheiros `.env`.**

### 2. Variáveis de ambiente

| Variável | Onde é usada | Descrição |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend e Functions | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend | Chave pública (respeita a RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions | Chave de administração. **Só no servidor, nunca no browser.** |
| `GEMINI_API_KEY` | Edge Functions | Geração de relatórios e assistente |
| `GEMINI_MODEL` | Edge Functions | Modelo de IA principal (opcional; mudar aqui se o Google retirar um modelo) |
| `GEMINI_FALLBACK_MODEL` | Edge Functions | Modelo de contingência (opcional) |
| `RESEND_API_KEY` | Edge Functions | Envio de e-mails (opcional em desenvolvimento) |
| `RESEND_FROM_EMAIL` | Edge Functions | Remetente dos e-mails |
| `RESEND_WEBHOOK_SECRET` | Rota `/api/webhooks/resend` | Segredo para verificar o webhook de aberturas de e-mail |
| `SCHEDULED_FUNCTION_SECRET` | Edge Functions e cron | Protege o endpoint de envios agendados |
| `NEXT_PUBLIC_APP_URL` | Frontend e Functions | URL base da aplicação (links nos e-mails) |
| `PAT_ENCRYPTION_KEY` | Edge Functions | Chave de cifragem do token do GitHub em repouso |
| `PORTAL_TOKEN_EXPIRATION_DAYS` | Edge Functions | Validade dos links do portal (por defeito 90 dias) |

Segredos das Edge Functions definem-se com `supabase secrets set NOME=valor`.

### 3. Base de dados e Edge Functions

```bash
supabase link --project-ref <o-teu-project-ref>
supabase db push --remote         # aplica as migrações em supabase/migrations
supabase functions deploy         # publica as Edge Functions
```

### 4. Agendamento automático (cron)

O envio agendado usa `pg_cron` e `pg_net` (um job horário que chama a função `dispatch-scheduled-reports`). O script está em [`supabase/cron/schedule_dispatch.sql`](./supabase/cron/schedule_dispatch.sql) e o procedimento em [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) (secção 5.6). O segredo fica no Supabase Vault, nunca no código.

### 5. Arrancar a aplicação

```bash
npm run dev
```

A aplicação fica disponível em http://localhost:3000.

### Scripts úteis

```bash
npm run lint          # análise estática (ESLint)
npx tsc --noEmit      # verificação estrita de tipos
npm test              # suíte de testes automatizados (segurança, bypass, mapeamento, tracking, idempotência, e-mail)
npm run check         # pipeline completo: lint + tsc + check:use-server + test + build de produção
npm run build         # build de produção Next.js
```

---

## Testes e Qualidade (DO-04 & DO-05)

- **Testes Automatizados (DO-04):** Executados através de `npm test` em Node.js 22, cobrindo:
  - `test:security` (BE-09): Validação de allowlist em runtime e bloqueio de leitura de código-fonte.
  - `test:bypass` (BE-16): Lógica de aprovação manual vs. envio automático direto.
  - `test:mapping` (BE-07): Mapeamento dinâmico de colunas e exclusão de colunas não mapeadas.
  - `test:tracking` (BE-21): Idempotência do carimbo `openedAt`, webhooks e pixel 1x1.
  - `test:dispatch` (BE-15/BE-16): Idempotência do despachador horário e prevenção de envios duplicados na mesma semana.
  - `test:email` (DO-04): Validação do URL canónico do portal `<appUrl>/portal/<token>` em PT e EN.
- **Isolamento de dados (RLS):** `supabase/tests/rls_isolation_test.sql` executa 10 verificações de isolamento entre agências e de acesso do portal por token.
- **Testes End-to-End (DO-05):** Fora do âmbito do MVP de 17/11/2026. Fica registado como evolução futura (testes E2E com Playwright/Cypress simulando fluxos completos em ambiente de staging).
- **Integração Contínua (CI):** O workflow do GitHub Actions (`.github/workflows/ci.yml`) corre em Node.js 22, validando lint, tipagem estrita, conformidade de server actions, todos os testes unitários e de integração (`npm test`) e compilação do Next.js.

---

## Estrutura do projeto

```
src/
  app/
    actions/       Server Actions (gerar, aprovar e enviar, onboarding)
    api/           Rotas de API (pixel de abertura de e-mail, webhook do Resend)
    dashboard/     Painel do profissional (clientes, revisão de relatórios)
    login/ register/  Autenticação
    onboarding/    Assistente de configuração (PulseBot)
    portal/[token]/   Portal do cliente sem login
  components/      UI: dashboard, marketing e componentes base
  lib/             api.ts (acesso a dados), edge.ts (Edge Functions), clientes Supabase, utilitários
  data/ e types/   Dados de apoio e tipos da base de dados
supabase/
  migrations/      Esquema SQL, RLS, funções e métricas (001 a 012)
  functions/       Edge Functions em Deno (+ _shared com código comum)
  cron/            Script de agendamento (pg_cron)
  tests/           Testes de isolamento RLS
scripts/           Scripts de teste automatizado (npm test)
docs/              Documentação do projeto
.github/           Workflow de CI e template de Pull Request
```

---

## Metodologia ágil

- **Gestão do trabalho:** GitHub Projects com quadro Kanban, issues numeradas por área (`FE-`, `BE-`, `DO-`, `DOC-`) e prioridade P0 a P3.
- **Sprints:** 3 sprints (Sprint 1 a 3 no quadro), ao longo das 5 semanas do calendário do PRD.
- **Branches e PRs:** a integração do backend foi feita direta no `Main` pela equipa de backend; daqui para a frente, trabalho em branches de funcionalidade, integrado por Pull Request com referência à issue (`Closes #N`).
- **Commits:** formato Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
- **Definição de pronto:** `npm run check` sem erros (lint, tipos, testes e build), sem segredos no repositório e critérios de aceitação da issue cumpridos.

## Estado do projeto

*Estado técnico revisto a 15/11/2026; situação documental da validação revista a 17/11/2026.*

| Área | Estado |
| :--- | :--- |
| Landing page, dashboard, revisão de rascunhos e portal do cliente | Concluído |
| Esquema da base de dados, RLS e acesso seguro ao portal (isolamento 10/10) | Concluído |
| Autenticação (Supabase Auth) | Concluído |
| Integração com GitHub Projects (PAT cifrado, mapeamento de colunas) | Concluído |
| Geração de relatórios com IA, com rascunho em bruto como contingência | Concluído |
| Aprovação, envio por e-mail e portal sem login (links com expiração e renovação) | Concluído |
| Assistente de onboarding (PulseBot) | Concluído (voz: evolução futura) |
| Agendamento automático (cron horário em produção) | Concluído |
| Envio direto sem aprovação (bypass) | Implementado, a validar no teste real |
| Métricas de sucesso | Implementadas, a recolher no teste real |
| Tracking de abertura de e-mail | Em revisão (depende de domínio verificado no Resend) |
| Teste real com o GitHub Project da equipa (2 ciclos) | Issue [DO-03 #37](https://github.com/cabrito33/ClientPulse-AI/issues/37) encerrada; execução e resultados reais ainda sem evidência publicada (ver [RESULTADOS.md](./docs/RESULTADOS.md) para confirmação) |

## Segurança e privacidade

- Row Level Security em todas as tabelas, com isolamento por utilizador.
- Portal do Cliente protegido por token UUID não adivinhável, com expiração e revogação.
- O token do GitHub é guardado cifrado (AES-GCM) e não é legível pelo browser.
- Chaves e segredos apenas em variáveis de ambiente e no Supabase Vault, nunca no código.
- As Edge Functions de gestão só aceitam pedidos do domínio da aplicação (CORS restrito), e o webhook do e-mail verifica a assinatura.
- Apenas metadados das tarefas são enviados à IA. O código-fonte nunca é lido.
- O rascunho gerado pela IA é sempre revisto pelo profissional, a menos que este ative o envio automático.

## Equipa

| Nome | Função |
| :--- | :--- |
| Afonso Pedro | Backend |
| Ricardo Santos | Frontend |
| Manel Homem | Frontend |
| Miguel Lima | Backend |

## Licença

Projeto académico. Todos os direitos reservados © 2026 Equipa ClientPulse AI.
