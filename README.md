# ClientPulse AI

Relatórios semanais de progresso para clientes, gerados com IA a partir do **GitHub Projects**.

Projeto desenvolvido no âmbito da unidade curricular de **Desenvolvimento de Software Ágil** ([CURSO / INSTITUIÇÃO], 2026/27).

**Demo:** https://weekly-client-reports.vercel.app
**Equipa:** 
| Afonso Pedro | Backend |
| Ricardo Santos| Frontend |
| Manel Homem | Frontend |
| Miguel Lima | Backend |

---

## O problema

Freelancers e pequenas agências (2 a 10 pessoas) gastam horas todas as semanas a compilar o estado das tarefas, a traduzir linguagem técnica para linguagem de negócio e a responder a clientes que querem saber "em que ponto estamos?". É tempo não faturável, e muitas vezes o cliente continua com dúvidas.

## A solução

O ClientPulse AI liga-se ao GitHub Projects do profissional, extrai as tarefas concluídas, os bloqueios e os próximos passos da semana, e usa IA para redigir um relatório claro, sem jargão técnico. O profissional revê e aprova o rascunho (ou ativa o envio automático). O cliente recebe um e-mail com o resumo e um link seguro para um **Portal do Cliente** só de leitura, sem necessidade de criar conta.

### Funcionalidades do MVP

- **Integração com GitHub Projects** (única fonte de dados no MVP): leitura de issues, estados, labels e responsáveis.
- **Relatório gerado por IA** em 3 blocos: *O que foi feito*, *Bloqueios / Atenção* e *Próximos passos*.
- **Fluxo de aprovação:** edição do rascunho e "Aprovar e Enviar", ou envio automático opcional.
- **Envio agendado por e-mail**, configurável por cliente (dia e hora).
- **Portal do Cliente sem login** (`/portal/[token]`): relatório da semana, histórico e gráfico de tarefas concluídas por sprint.
- **Dashboard do profissional:** relatórios pendentes e enviados, estado dos clientes, métricas por sprint.
- **Assistente de onboarding** para guiar a ligação ao GitHub e a criação do primeiro cliente.

### Fora do âmbito do MVP

Integrações com Trello, Notion e Jira, aprovações formais por parte do cliente no portal e autenticação do cliente final com credenciais.

---

## Stack

| Camada | Tecnologia |
| :--- | :--- |
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Recharts |
| Backend | Supabase (PostgreSQL, Auth, Row Level Security, Edge Functions em Deno) |
| IA | Google Gemini API |
| E-mail | Resend |
| Deploy | Vercel |

## Arquitetura (resumo)

- O **frontend** acede aos dados através de uma camada única, `src/lib/api.ts`.
- As **Edge Functions** (`supabase/functions/`) fazem a sincronização com o GitHub, a geração dos relatórios, a aprovação e envio, o agendamento e o assistente de onboarding.
- O **isolamento entre utilizadores** é garantido por Row Level Security. O Portal do Cliente acede aos dados através de uma função SQL segura que exige um token único, com suporte para expiração e revogação.
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

---

## Como correr o projeto localmente

### Pré-requisitos

- Node.js 20 ou superior
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
| `RESEND_API_KEY` | Edge Functions | Envio de e-mails (opcional em desenvolvimento) |
| `RESEND_FROM_EMAIL` | Edge Functions | Remetente dos e-mails |
| `SCHEDULED_FUNCTION_SECRET` | Edge Functions e cron | Protege o endpoint de envios agendados |
| `NEXT_PUBLIC_APP_URL` | Frontend e Functions | URL base da aplicação (links nos e-mails) |
| `PAT_ENCRYPTION_KEY` | Edge Functions | Chave de cifragem do token do GitHub em repouso |

Segredos das Edge Functions definem-se com `supabase secrets set NOME=valor`.

### 3. Base de dados e Edge Functions

```bash
supabase link --project-ref <o-teu-project-ref>
supabase db push                  # aplica as migrações em supabase/migrations
supabase functions deploy         # publica as Edge Functions
```

### 4. Arrancar a aplicação

```bash
npm run dev
```

A aplicação fica disponível em http://localhost:3000.

### Scripts úteis

```bash
npm run lint          # análise estática
npx tsc --noEmit      # verificação de tipos
npm run build         # build de produção
```

---

## Estrutura do projeto

```
src/
  app/             Páginas (landing, login, dashboard, portal, onboarding)
  components/      Componentes de UI, dashboard e marketing
  lib/             Acesso a dados (api.ts), clientes Supabase, utilitários
  data/ e types/   Tipos e dados de apoio
supabase/
  migrations/      Esquema SQL, RLS e funções
  functions/       Edge Functions (Deno)
  tests/           Testes de isolamento RLS
docs/              Documentação do projeto
```

---

## Metodologia ágil

- **Gestão do trabalho:** GitHub Projects com quadro Kanban, issues numeradas por área (`FE-`, `BE-`, `DO-`, `DOC-`) e prioridade P0 a P3.
- **Sprints:** [DURAÇÃO E NÚMERO DE SPRINTS, ex.: 3 sprints semanais].
- **Branches e PRs:** trabalho em branches de funcionalidade, integrado por Pull Request com referência à issue (`Closes #N`).
- **Commits:** formato Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
- **Definição de pronto:** lint e verificação de tipos sem erros, sem segredos no repositório e critérios de aceitação da issue cumpridos.

## Estado do projeto

| Área | Estado |
| :--- | :--- |
| Landing page, dashboard, revisão de rascunhos, portal do cliente | Concluído |
| Esquema da base de dados, RLS e acesso seguro ao portal | Concluído |
| Autenticação (Supabase Auth) | Concluído |
| Edge Functions (sync GitHub, geração, envio, agendamento) | Implementadas |
| Ligação do frontend às Edge Functions | Em curso |
| Cifragem do token do GitHub em repouso | Em curso |
| Chatbot de onboarding ligado ao backend | Em curso |
| Teste real com o GitHub Project da equipa | Por fazer |

*Atualizar esta tabela à medida que o projeto avança.*

## Segurança e privacidade

- Row Level Security em todas as tabelas, com isolamento por utilizador.
- Portal do Cliente protegido por token UUID não adivinhável, com expiração e revogação.
- Chaves e segredos apenas em variáveis de ambiente, nunca no código.
- Apenas metadados das tarefas são enviados à IA. O código-fonte nunca é lido.
- O rascunho gerado pela IA é sempre revisto pelo profissional, a menos que este ative o envio automático.

## Equipa

| Nome | Função |
| Afonso Pedro | Backend |
| Ricardo Santos| Frontend |
| Manel Homem | Frontend |
| Miguel Lima | Backend |

## Licença

Projeto académico. [INDICAR LICENÇA OU "Todos os direitos reservados"]
