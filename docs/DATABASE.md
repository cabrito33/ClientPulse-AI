# Database Architecture & Security Guide — ClientPulse AI

## 1. Introduction for Beginners

Welcome to the ClientPulse AI database design! If you are transitioning from Firebase Firestore or MongoDB to **PostgreSQL with Supabase**, here are three essential concepts to keep in mind:

1. **Relational Tables vs. Document Collections:** Instead of storing flexible, nested documents, relational databases store data in structured tables with strict column types. Tables link to each other using **Foreign Keys** (`REFERENCES other_table(id)`).
2. **PostgreSQL as the Single Source of Truth:** Foreign keys prevent "orphaned" records. For example, if an agency deletes a client, `ON DELETE CASCADE` automatically and safely cleans up all associated reports and task metrics.
3. **Row Level Security (RLS):** In traditional backends, developers write authorization checks in their API controllers (e.g., `if (client.agency_id !== req.user.id) return 403`). In Supabase, the database itself enforces security rules directly at the row level! Even if a malicious user bypasses the API, PostgreSQL will refuse to return any row that does not belong to that user.

---

## 2. Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    auth_users ||--|| agencies : "owns (1:1)"
    agencies ||--|| github_integrations : "configures (1:1)"
    agencies ||--o{ clients : "manages (1:N)"
    clients ||--o{ reports : "receives (1:N)"
    clients ||--o{ report_tasks : "tracks (1:N)"
    reports ||--o{ report_tasks : "contains (1:N)"

    agencies {
        uuid id PK
        uuid user_id FK "auth.users"
        text name
        timestamptz created_at
        timestamptz updated_at
    }

    github_integrations {
        uuid id PK
        uuid agency_id FK "agencies"
        text pat_token
        text github_username
        boolean is_valid
        timestamptz last_synced_at
        timestamptz created_at
    }

    clients {
        uuid id PK
        uuid agency_id FK "agencies"
        text name
        text email
        text company_name
        text communication_tone "formal | executive | casual"
        text language "pt | en"
        text github_project_id
        text github_project_owner
        text github_project_type "user | organization"
        jsonb column_mapping
        int schedule_day_of_week "0-6 (5 = Friday)"
        int schedule_hour_utc "0-23"
        boolean auto_send_enabled
        uuid portal_token "unique zero-login token"
        timestamptz created_at
        timestamptz updated_at
    }

    reports {
        uuid id PK
        uuid client_id FK "clients"
        uuid agency_id FK "agencies"
        text status "draft | approved | sent | failed"
        date period_start
        date period_end
        text summary_done "Block 1: Completed"
        text summary_blockers "Block 2: Blockers"
        text summary_next_steps "Block 3: Next Steps"
        jsonb raw_github_data
        timestamptz approved_at
        timestamptz sent_at
        text email_delivery_id
        timestamptz created_at
        timestamptz updated_at
    }

    report_tasks {
        uuid id PK
        uuid report_id FK "reports"
        uuid client_id FK "clients"
        text github_item_id
        text title
        text status_category "done | in_progress | blocked"
        text assignee
        text_array labels
        timestamptz closed_at
        timestamptz created_at
    }
```

---

## 3. Table Dictionary & Schema Specifications

### 3.1 `agencies`
Stores the agency or freelancer profile linked to a Supabase authenticated user.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique agency identifier. |
| `user_id` | `UUID` | `NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE` | 1-to-1 link with the Supabase Auth user. |
| `name` | `TEXT` | `NOT NULL` | Business name or freelancer name. |
| `created_at` | `TIMESTAMPTZ`| `DEFAULT now()` | Creation timestamp. |
| `updated_at` | `TIMESTAMPTZ`| `DEFAULT now()` | Last update timestamp. |

**Indexes:**
- `CREATE INDEX idx_agencies_user_id ON agencies(user_id);`

**RLS Policy:**
```sql
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own agency"
ON agencies FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```
*Plain English:* When an authenticated user queries `agencies`, PostgreSQL only allows them to view or edit the agency record where `user_id` matches their own login ID (`auth.uid()`).

---

### 3.2 `github_integrations`
Stores the GitHub Personal Access Token (PAT) used to query the GitHub Projects v2 GraphQL API.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique integration record ID. |
| `agency_id` | `UUID` | `NOT NULL UNIQUE REFERENCES agencies(id) ON DELETE CASCADE` | Agency owning this PAT. |
| `pat_token` | `TEXT` | `NOT NULL` | Fine-grained GitHub PAT (`read:project` and `repo` read-only). |
| `github_username` | `TEXT` | `NULL` | GitHub handle of the authenticated user. |
| `is_valid` | `BOOLEAN` | `DEFAULT true` | Set to false if API returns 401 Bad Credentials. |
| `last_synced_at` | `TIMESTAMPTZ`| `NULL` | Timestamp of last successful GraphQL sync. |
| `created_at` | `TIMESTAMPTZ`| `DEFAULT now()` | Creation timestamp. |

**Indexes:**
- `CREATE INDEX idx_github_integrations_agency ON github_integrations(agency_id);`

**RLS Policy:**
```sql
ALTER TABLE github_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agencies can manage their own GitHub integration"
ON github_integrations FOR ALL
TO authenticated
USING (agency_id IN (SELECT id FROM agencies WHERE user_id = auth.uid()))
WITH CHECK (agency_id IN (SELECT id FROM agencies WHERE user_id = auth.uid()));
```
*Plain English:* Only the agency owner can view or update their stored PAT token.

---

### 3.3 `clients`
Represents client accounts managed by the agency. Contains report personalization settings and scheduling details.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique client identifier. |
| `agency_id` | `UUID` | `NOT NULL REFERENCES agencies(id) ON DELETE CASCADE` | Agency that owns this client. |
| `name` | `TEXT` | `NOT NULL` | Client contact person's name. |
| `email` | `TEXT` | `NOT NULL` | Recipient email address for reports. |
| `company_name` | `TEXT` | `NULL` | Client organization/company name. |
| `communication_tone` | `TEXT` | `NOT NULL DEFAULT 'executive' CHECK (communication_tone IN ('formal', 'executive', 'casual'))` | Tone of voice for Gemini prompts. |
| `language` | `TEXT` | `NOT NULL DEFAULT 'pt' CHECK (language IN ('pt', 'en'))` | Report output language. |
| `github_project_id` | `TEXT` | `NOT NULL` | Target GitHub Projects v2 ID / Number. |
| `github_project_owner` | `TEXT` | `NOT NULL` | GitHub Organization or User handle. |
| `github_project_type` | `TEXT` | `NOT NULL DEFAULT 'organization' CHECK (github_project_type IN ('user', 'organization'))` | Distinguishes `user(...)` vs `organization(...)` GraphQL root. |
| `column_mapping` | `JSONB` | `NOT NULL DEFAULT '{"done": ["Done"], "in_progress": ["In Progress"], "blocked": ["Blocked"]}'::jsonb` | Maps GitHub board columns to standard report categories. |
| `schedule_day_of_week` | `INT` | `DEFAULT 5 CHECK (schedule_day_of_week BETWEEN 0 AND 6)` | Day to generate/send (5 = Friday). |
| `schedule_hour_utc` | `INT` | `DEFAULT 9 CHECK (schedule_hour_utc BETWEEN 0 AND 23)` | Hour in UTC to execute the report. |
| `auto_send_enabled` | `BOOLEAN` | `DEFAULT false` | If true, dispatches email immediately without waiting for manual dashboard approval. |
| `portal_token` | `UUID` | `NOT NULL UNIQUE DEFAULT gen_random_uuid()` | High-entropy token allowing the client zero-login portal access. |
| `created_at` | `TIMESTAMPTZ`| `DEFAULT now()` | Creation timestamp. |
| `updated_at` | `TIMESTAMPTZ`| `DEFAULT now()` | Last update timestamp. |

**Indexes:**
- `CREATE INDEX idx_clients_agency ON clients(agency_id);`
- `CREATE INDEX idx_clients_portal_token ON clients(portal_token);`
- `CREATE INDEX idx_clients_schedule ON clients(schedule_day_of_week, schedule_hour_utc);`

**RLS Policy:**
```sql
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agencies can manage their clients"
ON clients FOR ALL
TO authenticated
USING (agency_id IN (SELECT id FROM agencies WHERE user_id = auth.uid()))
WITH CHECK (agency_id IN (SELECT id FROM agencies WHERE user_id = auth.uid()));
```
*Plain English:* Agency users can only CRUD their own clients. The `portal_token` is hidden from the general public and can only be queried via the token-gated Edge Function using `service_role`.

---

### 3.4 `reports`
Stores every weekly progress report draft, approved version, and delivery metadata.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique report identifier. |
| `client_id` | `UUID` | `NOT NULL REFERENCES clients(id) ON DELETE CASCADE` | Target client. |
| `agency_id` | `UUID` | `NOT NULL REFERENCES agencies(id) ON DELETE CASCADE` | Agency workspace. |
| `status` | `TEXT` | `NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'sent', 'failed'))` | Report lifecycle status. |
| `period_start` | `DATE` | `NOT NULL` | Start date of the 7-day reporting period. |
| `period_end` | `DATE` | `NOT NULL` | End date of the 7-day reporting period. |
| `summary_done` | `TEXT` | `NOT NULL` | Block 1: Tasks completed in plain business language. |
| `summary_blockers`| `TEXT` | `NOT NULL` | Block 2: Obstacles and attention points. |
| `summary_next_steps`| `TEXT`| `NOT NULL` | Block 3: Upcoming decisions and deliverables. |
| `raw_github_data` | `JSONB` | `NULL` | Snapshot of raw task items from GitHub GraphQL. |
| `approved_at` | `TIMESTAMPTZ`| `NULL` | Timestamp when manager clicked "Approve and Send". |
| `sent_at` | `TIMESTAMPTZ`| `NULL` | Timestamp when Resend successfully dispatched the email. |
| `email_delivery_id`| `TEXT`| `NULL` | Resend message ID for delivery tracking. |
| `created_at` | `TIMESTAMPTZ`| `DEFAULT now()` | Generation timestamp. |
| `updated_at` | `TIMESTAMPTZ`| `DEFAULT now()` | Last update timestamp. |

**Indexes:**
- `CREATE INDEX idx_reports_client ON reports(client_id);`
- `CREATE INDEX idx_reports_agency_status ON reports(agency_id, status);`
- `CREATE INDEX idx_reports_period ON reports(period_end DESC);`

**RLS Policy:**
```sql
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agencies can manage their reports"
ON reports FOR ALL
TO authenticated
USING (agency_id IN (SELECT id FROM agencies WHERE user_id = auth.uid()))
WITH CHECK (agency_id IN (SELECT id FROM agencies WHERE user_id = auth.uid()));
```
*Plain English:* Agency managers have full CRUD rights over their reports. Clients access their reports through the secure `/client-portal-data` Edge Function.

---

### 3.5 `report_tasks`
Normalized record of individual GitHub cards associated with a report. Used by the client portal to display sprint delivery metrics (tasks completed per sprint).

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique task record ID. |
| `report_id` | `UUID` | `NOT NULL REFERENCES reports(id) ON DELETE CASCADE` | Linked report. |
| `client_id` | `UUID` | `NOT NULL REFERENCES clients(id) ON DELETE CASCADE` | Linked client. |
| `github_item_id` | `TEXT` | `NOT NULL` | GitHub item node ID. |
| `title` | `TEXT` | `NOT NULL` | Card title. |
| `status_category` | `TEXT` | `NOT NULL CHECK (status_category IN ('done', 'in_progress', 'blocked'))` | Normalized status. |
| `assignee` | `TEXT` | `NULL` | GitHub username of the assignee. |
| `labels` | `TEXT[]` | `DEFAULT '{}'` | Array of GitHub label names. |
| `closed_at` | `TIMESTAMPTZ`| `NULL` | When the card/issue was marked closed. |
| `created_at` | `TIMESTAMPTZ`| `DEFAULT now()` | Creation timestamp. |

**Indexes:**
- `CREATE INDEX idx_report_tasks_report ON report_tasks(report_id);`
- `CREATE INDEX idx_report_tasks_client_status ON report_tasks(client_id, status_category);`

**RLS Policy:**
```sql
ALTER TABLE report_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agencies can view their report tasks"
ON report_tasks FOR ALL
TO authenticated
USING (
  report_id IN (
    SELECT r.id FROM reports r
    JOIN agencies a ON r.agency_id = a.id
    WHERE a.user_id = auth.uid()
  )
);
```

---

## 4. Tabelas Adicionais (Migration 003)

### 4.1 `profiles`
Perfil do utilizador ligado 1:1 ao `auth.users` e à agência criada no signup.

| Coluna | Tipo | Restrições | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY REFERENCES auth.users(id)` | Mesmo UUID do utilizador Supabase Auth. |
| `agency_id` | `UUID` | `REFERENCES agencies(id) ON DELETE SET NULL` | Agência do utilizador. |
| `full_name` | `TEXT` | `NULL` | Nome completo. |
| `email` | `TEXT` | `NULL` | E-mail (espelho de auth.users). |
| `avatar_url` | `TEXT` | `NULL` | URL de avatar (OAuth). |
| `role` | `TEXT` | `DEFAULT 'owner'` | Papel na agência (owner, admin, etc.). |

**RLS:** SELECT e UPDATE apenas para o próprio utilizador (`id = auth.uid()`).

---

### 4.2 `sprint_metrics`
Métricas de velocidade de sprint por cliente. Usadas no dashboard e no portal do cliente.

| Coluna | Tipo | Restrições | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Identificador único. |
| `client_id` | `UUID` | `NOT NULL REFERENCES clients(id)` | Cliente associado. |
| `agency_id` | `UUID` | `NOT NULL REFERENCES agencies(id)` | Agência proprietária. |
| `sprint` | `TEXT` | `NOT NULL` | Código do sprint (ex: `S42`). |
| `label` | `TEXT` | `NOT NULL` | Etiqueta legível (ex: `Semana 42`). |
| `completed` | `INT` | `DEFAULT 0` | Tarefas concluídas. |
| `planned` | `INT` | `DEFAULT 0` | Tarefas planeadas. |

**RLS:** CRUD completo para a agência proprietária (`agency_id`). Leitura anónima via portal token.

---

### 4.3 `portal_tokens`
Tabela dedicada à gestão de tokens de portal com suporte a revogação e expiração.

| Coluna | Tipo | Restrições | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Identificador único. |
| `client_id` | `UUID` | `NOT NULL REFERENCES clients(id)` | Cliente a que pertence. |
| `agency_id` | `UUID` | `NOT NULL REFERENCES agencies(id)` | Agência proprietária. |
| `token` | `UUID` | `NOT NULL UNIQUE` | Token de acesso gerado aleatoriamente. |
| `is_active` | `BOOLEAN` | `DEFAULT true` | `false` após revogação manual. |
| `expires_at` | `TIMESTAMPTZ` | `NULL` | `NULL` = perpétuo; data = expiração. |
| `revoked_at` | `TIMESTAMPTZ` | `NULL` | Quando foi revogado manualmente. |

**RLS:** CRUD completo para a agência proprietária. `anon` não tem acesso directo.

---

### 4.4 `delivery_logs`
Registo de auditoria de cada envio de e-mail transaccional (Resend API).

| Coluna | Tipo | Restrições | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Identificador único. |
| `report_id` | `UUID` | `REFERENCES reports(id) ON DELETE SET NULL` | Relatório enviado. |
| `client_id` | `UUID` | `NOT NULL REFERENCES clients(id)` | Destinatário. |
| `agency_id` | `UUID` | `NOT NULL REFERENCES agencies(id)` | Agência remetente. |
| `status` | `TEXT` | `CHECK (status IN ('sent','delivered','bounced','failed'))` | Estado da entrega. |
| `email_service` | `TEXT` | `DEFAULT 'resend'` | Serviço de e-mail usado. |
| `recipient_email`| `TEXT` | `NOT NULL` | Endereço de destino. |
| `message_id` | `TEXT` | `NULL` | ID externo do Resend. |
| `error_message` | `TEXT` | `NULL` | Detalhe do erro, se falhou. |
| `sent_at` | `TIMESTAMPTZ` | `DEFAULT now()` | Timestamp de envio. |

**RLS:** SELECT e INSERT para a agência proprietária. UPDATE reservado ao `service_role` (Edge Functions).

---

## 5. Row Level Security — Referência Completa (BE-02)

### 5.1 Visão Geral

| Tabela | RLS Activo | Políticas Authenticated | Acesso Anónimo (Portal) |
| :--- | :---: | :--- | :---: |
| `agencies` | ✅ | SELECT, INSERT, UPDATE (próprio `user_id`) | ❌ |
| `github_integrations` | ✅ | SELECT, ALL (via `agency_id`) | ❌ |
| `clients` | ✅ | SELECT, INSERT, UPDATE, DELETE (via `agency_id`) | SELECT via portal token |
| `reports` | ✅ | SELECT, INSERT, UPDATE, DELETE (via `agency_id`) | SELECT via portal token |
| `report_tasks` | ✅ | ALL (via `report.agency_id`, com WITH CHECK) | SELECT via portal token |
| `profiles` | ✅ | SELECT, INSERT, UPDATE (próprio `id`) | ❌ |
| `sprint_metrics` | ✅ | SELECT, ALL (via `agency_id`) | SELECT via portal token |
| `portal_tokens` | ✅ | ALL (via `agency_id`) | ❌ |
| `delivery_logs` | ✅ | SELECT, INSERT (via `agency_id`) + UPDATE via `service_role` | ❌ |

### 5.2 Função Auxiliar `get_my_agency_id()`

```sql
CREATE OR REPLACE FUNCTION public.get_my_agency_id()
RETURNS UUID
LANGUAGE SQL SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT id FROM public.agencies WHERE user_id = auth.uid();
$$;
```

**Propósito:** Evita subqueries repetidas por linha em cada avaliação de política RLS.
**`SECURITY DEFINER`:** Executa com privilégios do owner, não do chamador — permite acesso seguro à tabela `agencies`.
**`STABLE`:** O resultado é constante dentro de uma transacção — o query planner pode fazer cache.

### 5.3 Padrão de Isolamento por Agência

Todas as tabelas com `agency_id` usam este padrão:

```sql
-- Para USING (leitura):
agency_id = public.get_my_agency_id()

-- Para WITH CHECK (escrita):
agency_id = public.get_my_agency_id()
```

### 5.4 Acesso ao Portal do Cliente (Anónimo)

O portal do cliente acede a dados **sem login Supabase**. A arquitectura de segurança é:

```
Browser (anon) → Edge Function client-portal-data
                  ↓ valida portal_token na BD
                  ↓ usa service_role (bypass RLS)
                  → retorna apenas dados do cliente
```

As políticas `anon` nas tabelas `clients`, `reports`, `sprint_metrics` e `report_tasks` são uma **segunda linha de defesa** caso a `anon key` seja exposta directamente ao browser. Usam a tabela `portal_tokens` para validar:
- Token activo (`is_active = true`)
- Token não expirado (`expires_at IS NULL OR expires_at > now()`)

### 5.5 Como Testar o Isolamento RLS

Executar o script completo de testes no Supabase SQL Editor:

**Ficheiro:** [`supabase/tests/rls_isolation_test.sql`](../supabase/tests/rls_isolation_test.sql)

```sql
-- Verificação rápida das políticas activas:
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

-- Verificação do RLS estar activo em todas as tabelas:
SELECT relname AS table_name, relrowsecurity AS rls_enabled
FROM pg_class
JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
WHERE pg_namespace.nspname = 'public' AND relkind = 'r'
ORDER BY relname;
```

**Testes cobertos pelo script:**
1. ✅ Utilizador A vê os seus próprios clientes
2. ✅ Utilizador B NÃO vê clientes da Agência A
3. ✅ Utilizador B NÃO vê relatórios da Agência A
4. ✅ Utilizador B NÃO vê o registo `agencies` da Agência A
5. ✅ Utilizador B NÃO consegue fazer UPDATE em dados da Agência A
6. ✅ Utilizador A vê os seus próprios relatórios
7. ✅ `get_my_agency_id()` retorna o `agency_id` correcto
8. ✅ Visitante anónimo acede ao portal via token válido (`get_portal_data_by_token`)
9. ✅ Visitante anónimo com token inexistente/inválido é rejeitado (`NULL`)
10. ✅ Visitante anónimo não consegue fazer `SELECT` direto às tabelas

### 5.6 Ficheiros de Migração

| Ficheiro | Tabelas / Funcionalidades Cobertas |
| :--- | :--- |
| `supabase/migrations/001_initial_schema.sql` | `agencies`, `github_integrations`, `clients`, `reports`, `report_tasks` |
| `supabase/migrations/003_be_01_complete_schema.sql` | `profiles`, `sprint_metrics`, `portal_tokens`, `delivery_logs` |
| `supabase/migrations/004_be_02_rls_policies.sql` | Completude: `get_my_agency_id()`, INSERT em `agencies`/`profiles`, correcções |
| `supabase/migrations/005_be_02_portal_rpc.sql` | RPC `get_portal_data_by_token` (SECURITY DEFINER) + revogação de SELECT direto para anon |
