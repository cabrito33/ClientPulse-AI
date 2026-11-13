# Roteiro de Teste Real em Produção — ClientPulse AI

**Projeto:** ClientPulse AI — Relatórios Semanais de Progresso para Freelancers e Agências  
**Data:** Novembro de 2026  
**Ambiente:** Produção (Supabase Cloud + Vercel / Next.js)  
**Fonte de Dados:** GitHub Projects API (Quadro do repositório da equipa)  

---

## 1. Objetivo do Teste Real

O presente documento define o procedimento operacional para a realização de **dois ciclos semanais consecutivos de validação real** do ClientPulse AI utilizando o quadro real de gestão do projeto no GitHub Projects.

Os testes cobrem os dois modos de funcionamento do produto previstos no PRD:
1. **Ciclo 1: Modo de Aprovação Manual (Human-in-the-Loop)** — Geração de rascunho via IA, revisão e edição rápida pelo utilizador, aprovação formal e envio por e-mail com link do Portal do Cliente.
2. **Ciclo 2: Modo de Envio Direto (Bypass de Aprovação)** — Automação ponta-a-ponta através do agendamento horário, geração e envio direto ao cliente sem retenção em rascunho, com verificação de idempotência (bloqueio de envios duplicados na mesma semana).

---

## 2. Checklist de Pré-Voo (Verificações Antes de Começar)

Antes de iniciar qualquer ciclo, confirme a configuração de todos os componentes no Supabase e no fornecedor de e-mail:

- [ ] **1. Secrets configurados nas Supabase Edge Functions:**
  Execute no terminal para verificar se os segredos estão definidos no projeto Supabase:
  ```bash
  npx supabase secrets list
  ```
  Devem constar obrigatoriamente:
  - `GEMINI_API_KEY`: Chave da Google AI Studio / Gemini API.
  - `RESEND_API_KEY`: Chave de envio transacional do Resend (`re_...`).
  - `SCHEDULED_FUNCTION_SECRET`: Segredo partilhado de 32 bytes hex para autenticação do cron e chamadas internas.
  - `PAT_ENCRYPTION_KEY`: Chave simétrica AES-256-GCM (hex de 32 bytes) para cifrar os tokens do GitHub na base de dados.
  - `RESEND_WEBHOOK_SECRET`: Segredo de assinatura do webhook do Resend (`whsec_...`) gerado no painel do Resend.
  - `PORTAL_TOKEN_EXPIRATION_DAYS`: Definido para `90` (ou omitido, assumindo 90 dias por defeito).
  - `NEXT_PUBLIC_APP_URL` / `APP_URL`: URL canónico da aplicação em produção (ex.: `https://clientpulse-ai.vercel.app` ou `http://localhost:3000` em teste local).

- [ ] **2. Modelo do Gemini Verificado:**
  - As Edge Functions utilizam como modelo primário `gemini-3.8-flash` (ou `gemini-1.5-flash`), com fallback automático em caso de sobrecarga ou erro 503 para `gemini-3.7-flash` e, em última instância, fallback para sumarização estruturada determinística sem IA (`generated_without_ai = true`), garantindo que o pipeline nunca bloqueia.

- [ ] **3. Agendamento Horário (Cron Job) Ativo:**
  No **SQL Editor** do Supabase, confirme se o agendamento horário está ativo:
  ```sql
  SELECT jobid, schedule, command, active FROM cron.job WHERE jobname = 'dispatch-hourly-reports';
  ```
  *(Se a lista estiver vazia, aplique as instruções de `supabase/cron/schedule_dispatch.sql` descritas na Secção 5.6 do `docs/ARCHITECTURE.md`).*

- [ ] **4. Webhook do Resend Configurado:**
  No painel do Resend em **Webhooks**:
  - **Endpoint URL:** `https://<DOMINIO>/api/webhooks/resend`
  - **Eventos:** `email.opened` (e opcionalmente `email.delivered`, `email.bounced`)
  - **Signing Secret:** Copiado para a variável de ambiente `RESEND_WEBHOOK_SECRET`.

- [ ] **5. Token de Acesso do GitHub (PAT):**
  - Personal Access Token (Classic) com permissões: `read:project` (e `repo` caso os repositórios associados ao projeto sejam privados).
  - Confirmar que o utilizador tem acesso de leitura ao projeto no GitHub.

---

## 3. Ciclo 1: Modo de Aprovação Manual (Human-in-the-Loop)

**Cenário:** A equipa concluiu tarefas do Sprint 1. O gestor da agência quer gerar um rascunho com o auxílio da IA, rever o texto durante 1 minuto, afinar detalhes e disparar o e-mail formal para o cliente.

### Passo 1.1: Onboarding e Configuração do Cliente Piloto
1. Aceda à rota `/onboarding` da aplicação.
2. Inicie a configuração com o assistente **PulseBot** (ou preencha o formulário rápido de configuração):
   - Insira o GitHub PAT clássico.
   - Selecione o quadro do GitHub da equipa.
   - Configure o mapeamento das 3 categorias fundamentais:
     - **Feito / Concluído:** Coluna correspondente no quadro (ex.: `Done` ou `Concluído`).
     - **Em Curso:** Coluna de trabalho ativo (ex.: `In Progress` ou `Em Curso`).
     - **Bloqueado:** Coluna de impedimentos (ex.: `Blocked` ou `Bloqueado`).
3. Crie o primeiro cliente:
   - **Nome:** `Cliente Piloto — Sprint 1`
   - **E-mail:** E-mail de teste de um dos elementos da equipa (para receber o relatório real).
   - **Agendamento:** Sexta-feira às 09:00 UTC.
   - **Envio Automático (Bypass):** **DESATIVADO** (`auto_send_enabled = false`).

### Passo 1.2: Preparação das Tarefas no GitHub Project
1. No quadro do GitHub Projects da equipa, certifique-se de que existem cartões reais distribuídos pelas colunas:
   - Pelo menos 2 a 3 tarefas na coluna **Feito** concluídas na semana em análise.
   - 1 a 2 tarefas na coluna **Em Curso**.
   - 1 tarefa com impedimento ou nota na coluna **Bloqueado** (ou sem bloqueios, se for o caso).

### Passo 1.3: Geração do Rascunho
1. Aceda à ficha do cliente em `/dashboard/clients/[id]`.
2. Clique no botão **"Gerar relatório agora"** (ou aguarde a execução do agendador horário).
3. A aplicação invoca a Edge Function `generate-report`, que:
   - Lê os metadados dos cartões via GraphQL do GitHub Projects.
   - Envia os títulos e notas para o Gemini gerar a síntese em 3 blocos em Português.
   - Armazena a versão inicial da IA em `reports.original_summary`.
   - Cria o relatório no estado `draft`.
4. Uma notificação confirma a geração com sucesso e redireciona para a revisão.

### Passo 1.4: Revisão Humana e Edição
1. Aceda ao ecrã de revisão em `/dashboard/reports/[id]`.
2. Avalie os 3 blocos gerados:
   - **O que foi feito esta semana**
   - **Bloqueios e impedimentos**
   - **Próximos passos**
3. Efetue intencionalmente **1 a 2 correções de texto** (ex.: ajustar o tom de uma frase ou clarificar um próximo passo).
4. O sistema calcula e armazena automaticamente a contagem de edições (`edit_count`) por comparação com `original_summary`.

### Passo 1.5: Aprovação e Disparo
1. Clique no botão **"Aprovar e Enviar"**.
2. A aplicação invoca a Edge Function `approve-and-send`:
   - Grava o estado final do relatório como `sent`.
   - Regista `approved_at`, `sent_at` e calcula o tempo de aprovação em segundos (`time_to_approve_seconds = approved_at - created_at`).
   - Garante a existência de um token ativo em `portal_tokens` com validade de 90 dias.
   - Envia o e-mail através do Resend com o URL canónico: `https://<DOMINIO>/portal/<TOKEN>`.

### Passo 1.6: Receção e Acesso ao Portal (Sem Login)
1. Abra a caixa de correio do destinatário e localize o e-mail enviado pelo ClientPulse AI.
2. Verifique o assunto: `Relatório Semanal de Progresso — Semana <N> / <ANO>`.
3. Verifique que o link no e-mail aponta estritamente para `/portal/<token>` e nunca para `?token=`.
4. Clique no botão do e-mail para abrir o **Portal do Cliente**.
5. No portal:
   - Confirme a visualização dos 3 blocos do relatório sem pedir palavra-passe ou login.
   - Verifique o histórico de relatórios anteriores.
   - Confirme a apresentação das métricas de entrega e gráfico de sprints.
6. Aceda à base de dados ou ao Dashboard do profissional e confirme que o registo de abertura (`opened_at`) foi registado através do webhook do Resend ou do pixel de tracking.

### O Que Registar no Ciclo 1:
- [ ] Duração do processo de onboarding (segundos/minutos decorridos).
- [ ] Tempo gasto na revisão até ao clique de aprovação (`time_to_approve_seconds`).
- [ ] Número de linhas editadas face à sugestão da IA (`edit_count`).
- [ ] Precisão das tarefas: verificar se todas as tarefas do quadro foram identificadas sem invenções.
- [ ] Confirmação do registo de `opened_at` no relatório.

---

## 4. Ciclo 2: Modo de Envio Direto Automático (Bypass de Aprovação)

**Cenário:** O profissional confia plenamente na consistência dos resumos e prefere automatizar totalmente o envio para clientes de rotina. Quando o agendador dispara, o relatório é gerado e enviado diretamente, sem intervenção humana.

### Passo 2.1: Ativação do Modo Bypass
1. Aceda a `/dashboard/clients/[id]` no cliente de teste.
2. Ative a opção **"Envio automático (bypass)"** (`auto_send_enabled = true`).
3. Confirme na interface que o agendamento indica **"Sexta-feira às 09:00 UTC"** (ou o horário configurado).

### Passo 2.2: Atualização do Quadro do GitHub
1. No GitHub Projects, simule a transição para a semana seguinte (ou movimente cartões para representar novas tarefas concluídas).
2. Adicione pelo menos 2 novas tarefas concluídas na coluna **Feito** e 1 novo próximo passo na coluna **Em Curso**.

### Passo 2.3: Disparo do Agendador (Dispatcher)
Para validar o agendamento sem esperar pela execução automática do cron, execute o comando PowerShell de teste fornecido na arquitetura:

```powershell
$Headers = @{
    "Content-Type" = "application/json"
    "X-Scheduled-Secret" = "<SCHEDULED_FUNCTION_SECRET>"
}
$Body = @{
    target_day = 5          # 5 = Sexta-feira
    target_hour_utc = 9     # 09:00 UTC
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://<PROJECT_REF>.supabase.co/functions/v1/dispatch-scheduled-reports" `
    -Method Post `
    -Headers $Headers `
    -Body $Body
```

### Passo 2.4: Verificação do Envio Automático
1. Analise a resposta JSON do comando. Deverá indicar:
   ```json
   {
       "status": "completed",
       "processed": 1,
       "sent": 1,
       "drafted": 0,
       "skipped_duplicate": 0,
       "errors": 0
   }
   ```
2. Aceda à tabela `reports` no Supabase ou ao Dashboard:
   - Confirme que o relatório foi criado diretamente com `status = 'sent'`.
   - Confirme que `edit_count = 0`.
   - Confirme que `time_to_approve_seconds = 0` (ou `null`).
3. Confirme que o e-mail foi recebido imediatamente na caixa de entrada do cliente, sem retenção no estado `draft`.

### Passo 2.5: Teste Crítico de Idempotência (Garantia de Envio Único)
1. **Execute novamente o mesmo comando PowerShell** do Passo 2.3 (simulando uma segunda execução acidental do cron na mesma semana).
2. Verifique a resposta da função:
   ```json
   {
       "status": "completed",
       "processed": 1,
       "sent": 0,
       "drafted": 0,
       "skipped_duplicate": 1,
       "errors": 0
   }
   ```
3. Confirme que:
   - Não foi gerado nenhum novo relatório duplicado na base de dados.
   - Nenhum e-mail adicional foi enviado ao cliente.
   - A regra de idempotência semanal (`findExistingWeekReport`) protegeu o cliente de múltiplos envios.

### O Que Registar no Ciclo 2:
- [ ] Confirmação de que o relatório transitou diretamente para `sent`.
- [ ] Tempo de resposta e execução da Edge Function `dispatch-scheduled-reports`.
- [ ] Confirmação de receção do e-mail com token válido de portal.
- [ ] Sucesso do teste de idempotência (`skipped_duplicate = 1` na segunda tentativa).

---

## 5. Procedimentos de Recuperação de Falhas (Troubleshooting)

Caso ocorra algum imprevisto durante os testes reais, siga os procedimentos descritos abaixo:

### 5.1 Falha na Leitura do GitHub Projects (Erro 401 ou 404)
- **Sintoma:** Mensagem de erro "Falha ao obter dados do GitHub" ou "Projeto não encontrado".
- **Causa:** O token PAT expirou, foi revogado ou não possui a permissão `read:project`.
- **Recuperação:**
  1. No GitHub, crie um novo Personal Access Token (Classic) com scope `read:project`.
  2. Aceda às definições do cliente ou reinicie o onboarding para atualizar a credencial.
  3. O novo token é automaticamente cifrado com a chave `PAT_ENCRYPTION_KEY`.

### 5.2 Latência ou Erro 503 / Quota na API do Gemini
- **Sintoma:** A IA demora mais de 10 segundos ou devolve código 503.
- **Comportamento Esperado:** A aplicação aciona o fallback automático para o modelo secundário e, se persistir, ativa o modo determinístico sem IA (`generated_without_ai = true`).
- **Recuperação:** O relatório é gerado com a listagem crua das tarefas dividida pelos 3 blocos estruturados. O utilizador pode rever e editar normalmente o texto no ecrã de revisão antes de aprovar.

### 5.3 Erro de Envio no Resend (Código 403 ou Domínio Não Verificado)
- **Sintoma:** O relatório transita para o estado `failed` com mensagem de erro de envio.
- **Recuperação:**
  1. Verifique se o remetente configurado em `RESEND_FROM_EMAIL` pertence a um domínio verificado no Resend (ou utilize o remetente de teste padrão `onboarding@resend.dev` para destinatários autorizados).
  2. Aceda ao relatório falhado em `/dashboard/reports/[id]`.
  3. Clique no botão de contingência **"Tentar reenviar e-mail"**.

### 5.4 Token de Portal Expirado ou Revogado
- **Sintoma:** O cliente clica no link do e-mail e é recebido com a mensagem "Link de Acesso Expirado ou Revogado".
- **Recuperação:**
  1. O gestor acede a `/dashboard/clients/[id]`.
  2. Clica na ação **"Renovar link do portal"**.
  3. O sistema revoga o token antigo (`is_active = false, revoked_at = now()`) e gera um novo token seguro com 90 dias de validade.
  4. O gestor pode copiar o novo link e facultá-lo diretamente ao cliente.

### 5.5 Limpeza e Repetição do Teste
Para repetir um ciclo de teste sem eliminar a conta da agência nem o cliente, execute o seguinte comando no SQL Editor do Supabase para arquivar ou remover apenas os relatórios da semana de teste:

```sql
-- Remove relatórios de teste e tokens associados para o cliente específico
DELETE FROM public.reports 
WHERE client_id = '<CLIENT_UUID>' 
  AND week_label = 'Semana <N> / 2026';

-- Mantém a integridade referencial e o registo do cliente
```
