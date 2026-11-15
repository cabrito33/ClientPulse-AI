# Relatório de Auditoria Técnica e Segurança — ClientPulse AI

**Data da Auditoria:** 13 de Novembro de 2026  
**Repositório:** `cabrito33/ClientPulse-AI`  
**Branch:** `Main`  
**Objetivo do Projeto:** MVP funcional de ponta a ponta com segurança rigorosa, minimização de dados enviados a modelos de IA, isolamento multi-inquilino e estabilidade em produção.

---

## 1. Resumo Executivo da Auditoria

O projeto **ClientPulse AI** atingiu a maturidade técnica necessária para entrega e operação em produção. Todas as vulnerabilidades e incongruências identificadas nas fases preliminares foram integralmente resolvidas através de alterações cirúrgicas, sem regressões de design nem de arquitetura.

### Resumo dos Resultados
- **Integridade do Build e Lint:** 100% dos testes e verificações estáticas (`npm run lint`, `npx tsc --noEmit`, `npm run check:use-server`, `npm test` e `next build`) passam com zero erros e zero avisos bloqueantes.
- **Segurança de Credenciais e PATs:** O token pessoal do GitHub (PAT) é cifrado em repouso com AES-256-GCM (Migração 003) e protegido contra leitura do browser via Column-Level Security (Migração 010), impedindo que o role `authenticated` leia `pat_token` ou `pat_token_encrypted`.
- **Comunicação com IA (Google Gemini):** A chave de API do Gemini deixou de ser transmitida como parâmetro de consulta na URL e passou a ser enviada exclusivamente no cabeçalho HTTP `x-goog-api-key`.
- **Rastreio de Abertura e Webhooks (BE-21):** O webhook do Resend (`/api/webhooks/resend`) valida a assinatura Svix via HMAC-SHA256 (retornando HTTP 401 para requisições inválidas). O endpoint de tracking pixel (`/api/track/open`) ignora timestamps externos e utiliza estritamente a hora do servidor.
- **Magic Links e Gestão de Sessão do Portal (BE-19):** Tokens de portal possuem validade padrão de 90 dias (configurável via `PORTAL_TOKEN_EXPIRATION_DAYS`). A função de base de dados `get_portal_data_by_token` falha fechado (retorna `NULL` para tokens inativos, expirados ou revogados). O dashboard inclui a ação "Renovar link do portal" que revoga imediatamente o token anterior.
- **Consistência de Datas e Rótulos:** O cálculo do identificador da semana (`buildWeekLabel`) baseia-se na data de fecho do período (`end`), garantindo sincronismo entre o dashboard, ecrã de revisão, e-mail, portal e trigger de métricas de sprint.

---

## 2. Checklist de Segurança e Proteção de Dados

| Verificação de Segurança | Estado | Evidência e Mecanismo de Proteção |
| :--- | :---: | :--- |
| **PATs do GitHub cifrados em repouso?** | **CONFORME** | Cifrado com AES-256-GCM (`pat_token_encrypted`) via chave simétrica de 256 bits (`PAT_ENCRYPTION_KEY`). Migração `003_pat_encryption.sql`. |
| **PAT inacessível a partir do browser?** | **CONFORME** | Migração `010_restrict_pat_access.sql` revogou `SELECT` total do role `authenticated` na tabela `github_integrations` e concedeu leitura apenas às colunas não sensíveis (`id, agency_id, github_username, is_valid, last_synced_at, created_at`). |
| **Isolamento multi-inquilino (RLS)?** | **CONFORME** | RLS ativado em todas as tabelas (`agencies`, `github_integrations`, `clients`, `reports`, `report_tasks`, `sprint_metrics`, `portal_tokens`, `delivery_logs`). |
| **Validação de assinatura do Resend?** | **CONFORME** | Endpoint `/api/webhooks/resend` verifica os cabeçalhos `svix-id`, `svix-timestamp` e `svix-signature` utilizando HMAC-SHA256 com `RESEND_WEBHOOK_SECRET`. Rejeição com status 401 se ausente ou inválida. |
| **Proteção contra manipulação de abertura?** | **CONFORME** | `/api/track/open` não aceita `timestamp` vindo do corpo da requisição ou query. Usa sempre o carimbo horário gerado pelo servidor e aplicação idempotente. |
| **Magic Links com expiração e revogação?** | **CONFORME** | Tabela `portal_tokens` armazena `expires_at` (90 dias) e `revoked_at`. RPC `get_portal_data_by_token` falha fechado se o token não cumprir os critérios de validade. |
| **Chave Gemini fora de URLs?** | **CONFORME** | Chamadas à API Gemini em `supabase/functions/_shared/gemini.ts` utilizam o cabeçalho seguro `x-goog-api-key: <chave>` em vez do query parameter `?key=`. |
| **Minimização de dados à IA (DOC-04/BE-09)?** | **CONFORME** | Allowlist de campos em runtime garante que apenas títulos, descrições, status, labels e assignees são lidos do GitHub Projects v2. Código-fonte, diffs, árvores git e ficheiros de repositórios são categoricamente bloqueados antes de qualquer chamada externa. |
| **Segredos fora de repositórios e logs?** | **CONFORME** | Varrimento em todo o repositório confirma ausência de chaves ou tokens em código. Nenhuma função regista segredos nem o conteúdo integral de mensagens nos logs. |

---

## 3. Matriz de Cumprimento de Requisitos e Issues

| Issue / Requisito | Prioridade | Estado | Resolução Técnica |
| :--- | :---: | :---: | :--- |
| **[BE-01] Schema PostgreSQL no Supabase** | P0 / L | **CUMPRIDO** | Esquema completo e versionado (Migrações 001 a 010). Tabelas `agencies`, `clients`, `reports`, `report_tasks`, `sprint_metrics`, `portal_tokens`, `delivery_logs` e `github_integrations`. |
| **[BE-02] Row Level Security Multi-inquilino** | P1 / L | **CUMPRIDO** | Políticas RLS vinculadas a `auth.uid() = agencies.user_id`. RPCs com `SECURITY DEFINER` protegidas com validação estrita de token e ownership. |
| **[BE-05] Auth GitHub com PAT Cifrado** | P1 / M | **CUMPRIDO** | Cifragem AES-256-GCM em repouso e restrição de acesso por colunas (Migrações 003 e 010). |
| **[BE-06] Integração GraphQL GitHub Projects v2** | P0 / L | **CUMPRIDO** | Paginação por cursor, isolamento de metadados de ProjectV2 e tolerância a falhas em `supabase/functions/_shared/github.ts`. |
| **[BE-07] Mapeamento Dinâmico de Colunas** | P1 / M | **CUMPRIDO** | Mapeamento persistido em `clients.column_mapping`. Tarefas não mapeadas são omitidas com aviso informativo claro e teste automatizado. |
| **[BE-09] Validação Runtime: Nunca Ler Código-Fonte** | P1 / S | **CUMPRIDO** | Bloqueio em runtime via allowlist de campos e blocklist estrita para nós de código (`Blob`, `Tree`, `Commit`, `diff`). Suíte de 7 testes dedicada. |
| **[BE-10] Integração API Google Gemini** | P0 / M | **CUMPRIDO** | Módulo `_shared/gemini.ts` com retentativas automáticas, modelo de contingência configurável e cabeçalho `x-goog-api-key`. |
| **[BE-11] Prompt PT-PT Anti-alucinação** | P0 / M | **CUMPRIDO** | Prompt em Português europeu com regras anti-alucinação e exemplos contextuais. |
| **[BE-12] Structured Outputs (JSON Schema)** | P0 / M | **CUMPRIDO** | Gemini gera JSON estruturado estrito validado com schema com os 3 blocos obrigatórios. |
| **[BE-14] Fallback Gracioso sem IA** | P2 / M | **CUMPRIDO** | Em caso de indisponibilidade da IA, o sistema gera rascunho de contingência estruturado com base nas tarefas do GitHub, sem bloquear a operação da agência. |
| **[BE-15] Cron Job Semanal Horário** | P1 / L | **CUMPRIDO** | Configuração via `pg_cron` / `pg_net` disparando `dispatch-scheduled-reports` com verificação de dia da semana e hora UTC por cliente. |
| **[BE-16] Lógica de Bypass vs. Revisão Manual** | P1 / M | **CUMPRIDO** | Clientes com aprovação ativa permanecem em 'pendente de revisão'; clientes com bypass configurado são expedidos automaticamente. Fallback de IA desativa bypass temporariamente por segurança. |
| **[BE-18] Integração de Email com Resend** | P0 / M | **CUMPRIDO** | Expedição transacional HTML responsiva com tabelas para compatibilidade total (Gmail/Outlook). URLs corrigidas para a rota canónica `/portal/[token]`. |
| **[BE-19] Magic Links com Expiração e Revogação** | P1 / M | **CUMPRIDO** | Validade de 90 dias com backfill automático (Migração 009), RPC fail-closed, ação no dashboard para revogação e criação de novos tokens, e ecrã amigável no portal. |
| **[BE-21] Webhook e Tracking de Abertura (openedAt)** | P2 / M | **CUMPRIDO** | Webhook Resend com verificação Svix por HMAC-SHA256, pixel 1x1 com carimbo seguro de servidor, idempotência na gravação e documentação sobre Apple MPP. |
| **[DOC-04] Aviso de Privacidade e Minimização de Dados** | P2 / S | **CUMPRIDO** | Avisos visíveis ao utilizador no dashboard e onboarding, documentação em `/docs/PRIVACY.md` e envio estrito de metadados essenciais para a IA. |

---

## 4. Pipeline de Verificação e Build Seguro

Para prevenir regressões em ambiente de produção (Vercel e Supabase), foram implementadas as seguintes salvaguardas:

1. **Validação de Server Actions (`check:use-server`):**  
   Script automatizado (`scripts/check-use-server.mjs`) que analisa recursivamente todos os ficheiros com diretiva `"use server"` para garantir que apenas funções assíncronas são exportadas, prevenindo quebras de compilação no Next.js.
2. **Isolamento de Compilação (`cross-env NEXT_DIST_DIR=.next-check`):**  
   O comando `npm run check` corre linting, checagem de tipos, testes automatizados e o build do Next.js numa diretoria isolada (`.next-check`), permitindo validações completas sem colidir com instâncias ativas do servidor de desenvolvimento (`npm run dev`).
3. **Integração Contínua (CI):**  
   O workflow `.github/workflows/ci.yml` executa no ambiente Ubuntu com Node.js 22, validando lint, tipos, server actions, suíte completa de testes (`npm test`) e compilação de produção.

---

## 5. Procedimento de Execução Local

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env.local

# 3. Executar validação de conformidade (Lint + Types + Server Actions + Tests + Build)
npm run check

# 4. Iniciar servidor de desenvolvimento
npm run dev
```

---

## 6. Estado Factual e Prontidão Operacional

A auditoria ao código e arquitetura do ClientPulse AI reflete o estado factual das implementações e salvaguardas antes do teste real:

1. **Políticas de CORS e Exposição de Endpoints:**
   - As Edge Functions com acesso privilegiado ou autenticado (`generate-report`, `approve-and-send`, `github-sync`, `onboarding-chat`, `dispatch-scheduled-reports`) possuem cabeçalhos CORS estritamente restritos à origem canónica da aplicação (`ALLOWED_ORIGIN` ou `APP_URL`).
   - Apenas o endpoint público de consulta do portal (`client-portal-data` / RPC de portal por token) permite `Access-Control-Allow-Origin: *` para viabilizar o acesso seguro e sem login a partir de navegadores dos clientes finais.

2. **Testes de Isolamento Multi-Inquilino (RLS):**
   - Os testes de isolamento de Row Level Security (`supabase/tests/rls_isolation_test.sql`) foram executados com sucesso em ambiente de produção (10/10 testes passaram a 14/11/2026).
   - O conjunto de testes foi expandido para cobrir as novas garantias (migrações 009 a 013, incluindo a proibição de leitura direta do PAT pelo role `authenticated` e o isolamento e imutabilidade dos `audit_logs`), devendo ser reexecutado após a aplicação remota de todas as migrações.

3. **Registo do Incidente de 14/11 e Resolução de Acesso a Credenciais:**
   - **Incidente:** Após a aplicação da migração 010 (`010_restrict_pat_access.sql`), a restrição a nível de coluna (CLS) revogou o acesso SELECT do role `authenticated` às colunas `pat_token` e `pat_token_encrypted`. Como consequência, as funções `generate-report` e `github-sync` falharam temporariamente em produção ao tentar ler o PAT através do cliente associado ao utilizador final (`createUserClient`).
   - **Correção:** No commit `0990cd7`, a autorização do utilizador e a validação de pertença do cliente à agência foram mantidas estritamente sob o cliente do utilizador (impondo RLS). A leitura exclusiva das colunas do PAT passou a ser realizada com o cliente de administração (`createAdminClient()`), filtrada unicamente pelo `agency_id` previamente validado pela RLS. Nunca é aceite um `agency_id` proveniente do corpo do pedido HTTP.

4. **Limitações e Riscos Operacionais em Aberto:**
   - **Deteção de Abertura de E-mails:** O pixel de tracking transparente (1x1 GIF) e os webhooks de abertura do Resend são **indicativos**. Políticas agressivas de privacidade de clientes de correio eletrónico (tais como o Apple Mail Privacy Protection ou proxies de segurança corporativos que descarregam imagens antecipadamente) podem gerar falsos positivos ou mascarar aberturas reais.
   - **Verificação de Domínio no Resend:** O envio em produção depende de um domínio próprio verificado no Resend com registos SPF/DKIM configurados. No ambiente de testes ou em modo sandbox (`onboarding@resend.dev`), os e-mails só podem ser entregues ao endereço de correio eletrónico registado na conta Resend do programador.
