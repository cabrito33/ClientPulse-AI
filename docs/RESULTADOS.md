# Resultados e Validação de Métricas — ClientPulse AI

**Projeto:** ClientPulse AI — Relatórios Semanais de Progresso para Freelancers e Agências  
**Documento:** Template de Registo e Validação de Métricas Reais do MVP  
**Referência:** PRD v2.0 (Secção 7: Métricas de Sucesso e Critérios de Falha) e `docs/TESTE_REAL.md`  
**Data de Execução dos Testes:** `[ A preencher: DD/MM/AAAA ]`  
**Responsável pelo Teste:** `[ A preencher: Nome / Equipa ]`  
**Ambiente de Execução:** `[ A preencher: Ex.: Supabase Cloud (rewurbzemhydcqhmornx) + Vercel ]`  
**Repositório / Quadro de Teste:** `[ A preencher: Repositório GitHub e ID do ProjectV2 ]`  

---

## 1. Consultas SQL para Extração das Métricas

Execute as seguintes consultas no **SQL Editor** do Supabase para recolher os dados reais agregados e detalhados. Os resultados obtidos devem ser transcritos para as tabelas das secções seguintes.

### Consulta 1.1: Métricas Agregadas da View `success_metrics`
Esta vista calcula automaticamente os indicadores-chave de desempenho por agência com base na telemetria recolhida:

```sql
SELECT 
    agency_id,
    onboarding_duration_seconds,
    total_reports,
    total_approved_or_sent,
    total_sent,
    avg_edit_count,
    pct_approved_under_3_edits,
    avg_time_to_approve_seconds,
    pct_opened_24h,
    pct_generated_without_ai
FROM public.success_metrics;
```

### Consulta 1.2: Detalhe Individual dos Relatórios (`reports`)
Permite inspecionar cada relatório gerado, os tempos de aprovação e as edições efetuadas:

```sql
SELECT 
    id,
    week_label,
    status,
    edit_count,
    review_opened_at,
    time_to_approve_seconds,
    created_at,
    approved_at,
    sent_at,
    opened_at,
    (raw_github_data->>'generated_without_ai')::boolean AS modo_sem_ia
FROM public.reports
ORDER BY created_at DESC;
```

### Consulta 1.3: Auditoria de Magic Links e Acessos ao Portal (`portal_tokens`)
Verifica o ciclo de vida dos tokens de acesso e os prazos de expiração (garantia dos 90 dias):

```sql
SELECT 
    client_id,
    token,
    is_active,
    expires_at,
    revoked_at,
    created_at
FROM public.portal_tokens
ORDER BY created_at DESC;
```

---

## 2. Quadro Resumo de Métricas do PRD

Registo comparativo entre os objetivos quantitativos definidos no **PRD v2.0** e os valores observados no teste real em produção.

| Métrica de Sucesso | Meta no PRD (Alvo) | Valor Real Observado | Estado (Atingido / Não Atingido) | Notas e Observações |
| :--- | :--- | :--- | :--- | :--- |
| **Tempo de Onboarding** | < 5 minutos (< 300 s) | `[ ]` segundos | `[ ]` | Medido entre `onboarding_started_at` e `onboarding_completed_at`. |
| **Eficácia do Bot de Onboarding** | >= 85% de conclusão na 1.ª sessão | `[ ]` % | `[ ]` | Utilizadores que completaram o setup através do assistente conversacional. |
| **Tempo de Preparação Semanal** | < 10 min por cliente/semana | `[ ]` minutos | `[ ]` | Tempo total incluindo geração, revisão e aprovação. |
| **Tempo ativo de revisão** | < 2 minutos (< 120 s) | `[ ]` segundos | `[ ]` | Média de `time_to_approve_seconds` nos relatórios aprovados (calculado desde `review_opened_at` até `approved_at`, ignorando tempo parado). |
| **Média de Edições por Rascunho** | < 3 linhas por rascunho | `[ ]` linhas | `[ ]` | Campo `avg_edit_count` na vista `success_metrics`. |
| **Rascunhos com < 3 Edições** | >= 80% dos relatórios | `[ ]` % | `[ ]` | Campo `pct_approved_under_3_edits`. |
| **Precisão da IA (Medição Manual)** | >= 80% das tarefas refletidas | `[ ]` % | `[ ]` | Tarefas do quadro representadas fielmente sem alucinações. |
| **Taxa de Abertura em 24h** | >= 70% das mensagens enviadas | `[ ]` % | `[ ]` | Indicativo (rastreio de abertura via webhook / pixel). |
| **Taxa de Fallback sem IA** | < 5% de falhas da IA | `[ ]` % | `[ ]` | Percentagem de relatórios gerados via modo determinístico. |

---

## 3. Registo Detalhado por Ciclo Semanal

### 3.1 Ciclo 1: Modo de Aprovação Manual (Human-in-the-Loop)

- **ID do Relatório:** `[ Preencher UUID ]`
- **Semana de Referência:** `[ Preencher: Ex.: Semana 46 / 2026 ]`
- **Data e Hora de Geração:** `[ Preencher: AAAA-MM-DD HH:MM ]`
- **Data e Hora de Aprovação:** `[ Preencher: AAAA-MM-DD HH:MM ]`

| Parâmetro de Medição | Valor Medido | Observações |
| :--- | :--- | :--- |
| Duração do Onboarding (`onboarding_duration_seconds`) | `[ ]` segundos | Tempo desde o ecrã inicial até à criação do 1.º cliente. |
| Tempo de Revisão Humana Ativa (`time_to_approve_seconds`) | `[ ]` segundos | Intervalo entre a abertura do ecrã de revisão (`review_opened_at`) e a aprovação (`approved_at`). |
| Contagem de Edições Efetuadas (`edit_count`) | `[ ]` alterações | Linhas alteradas, acrescentadas ou removidas face ao original. |
| Estado Final do Relatório | `[ ]` | `sent` |
| URL Canónico do Portal no E-mail | `[ ]` | Confirmado formato `/portal/[token]` (nunca `?token=`). |
| Registo de Abertura do E-mail (`opened_at`) | `[ ]` | Data/hora registada pela telemetria do webhook. |

---

### 3.2 Ciclo 2: Modo de Envio Direto (Bypass de Aprovação)

- **ID do Relatório:** `[ Preencher UUID ]`
- **Semana de Referência:** `[ Preencher: Ex.: Semana 47 / 2026 ]`
- **Data e Hora de Disparo:** `[ Preencher: AAAA-MM-DD HH:MM ]`
- **Modo Bypass Ativo:** `SIM (auto_send_enabled = true)`

| Parâmetro de Medição | Valor Medido | Observações |
| :--- | :--- | :--- |
| Transição Direta de Estado | `[ ]` | O relatório passou diretamente para `sent` sem intervenção humana. |
| Tempo de Execução do Dispatcher | `[ ]` ms | Duração total da execução da Edge Function `dispatch-scheduled-reports`. |
| Edições Registadas (`edit_count`) | `[ ]` | Deve ser `0` por ser envio direto sem revisão. |
| Tempo de Aprovação (`time_to_approve_seconds`) | `[ ]` | Deve ser `0` ou nulo (aprovação imediata). |
| Receção do E-mail no Destinatário | `[ ]` | Confirmada receção na caixa de correio com link de portal funcional. |
| Teste de Idempotência (2.º Disparo Imediato) | `[ ]` | Resposta confirmada com `skipped_duplicate: 1` e zero e-mails adicionais. |

---

## 4. Medição Manual de Precisão da IA (Validação Cruzada)

A validação da fidelidade da IA é realizada comparando diretamente as tarefas presentes no quadro do **GitHub Projects** na semana correspondente com o texto gerado nos 3 blocos do relatório.

**Fórmula de Cálculo:**
$$\text{Precisão da IA} = \left( \frac{\text{Número de Tarefas Reais Fielmente Refletidas}}{\text{Total de Tarefas Reais Concluídas ou em Curso no Quadro}} \right) \times 100$$

### Tabela de Amostragem de Tarefas:

| # | Título da Tarefa no GitHub Project | Coluna Real no GitHub | Refletida no Relatório? | Alucinação ou Erro de Interpretação? |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `[ Tarefa 1 ]` | `[ Feito / Em Curso / Bloqueado ]` | `[ Sim / Não ]` | `[ Nenhuma / Detalhe ]` |
| 2 | `[ Tarefa 2 ]` | `[ Feito / Em Curso / Bloqueado ]` | `[ Sim / Não ]` | `[ Nenhuma / Detalhe ]` |
| 3 | `[ Tarefa 3 ]` | `[ Feito / Em Curso / Bloqueado ]` | `[ Sim / Não ]` | `[ Nenhuma / Detalhe ]` |
| 4 | `[ Tarefa 4 ]` | `[ Feito / Em Curso / Bloqueado ]` | `[ Sim / Não ]` | `[ Nenhuma / Detalhe ]` |
| 5 | `[ Tarefa 5 ]` | `[ Feito / Em Curso / Bloqueado ]` | `[ Sim / Não ]` | `[ Nenhuma / Detalhe ]` |

- **Total de tarefas no quadro:** `[ ]`
- **Tarefas corretamente transcritas:** `[ ]`
- **Tarefas em falta (omissões):** `[ ]`
- **Tarefas inventadas (alucinações):** `[ ]`
- **Taxa de Precisão Final:** `[ ] %`

---

## 5. Análise de Redução de Tempo (Antes vs. Depois)

Comparação do tempo despendido no processo de comunicação com o cliente:

| Etapa do Processo | Tempo Manual Tradicional (Sem ClientPulse) | Tempo com ClientPulse AI | Poupança Estimada |
| :--- | :--- | :--- | :--- |
| Recolha e triagem de tarefas no GitHub | 45 a 90 minutos | 0 minutos (automático via GraphQL) | ~ 100% |
| Redação do texto em linguagem de negócio | 60 a 120 minutos | ~ 10 segundos (IA Gemini) | ~ 98% |
| Formatação e composição do e-mail | 30 a 45 minutos | 0 minutos (template automático) | ~ 100% |
| Revisão e envio pelo gestor | N/A | `[ ]` segundos | Processo reduzido a 1 clique |
| **Tempo Total Semanal por Cliente** | **2,5 a 4,5 horas** | **`[ ]` minutos** | **> 85% de redução** |

---

## 6. Feedback Qualitativo e Notas dos Testadores

Espaço reservado para observações qualitativas recolhidas durante o teste real:

- **Usabilidade e Clareza do Onboarding:**
  `[ Registo de notas da equipa sobre a experiência com o PulseBot e a configuração das colunas ]`

- **Tom e Qualidade da Redação da IA:**
  `[ Avaliação da clareza do Português europeu gerado e da ausência de termos técnicos excessivos ]`

- **Experiência do Cliente no Portal:**
  `[ Feedback sobre a navegação sem login, clareza do histórico e leitura nos dispositivos móveis ]`

- **Pontos Fortes Identificados:**
  `[ Destaques observados durante a execução dos ciclos ]`

- **Oportunidades de Melhoria para Versões Futuras:**
  `[ Sugestões e refinamentos para o backlog pós-entrega ]`
