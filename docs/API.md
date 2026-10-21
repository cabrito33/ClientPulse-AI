# Edge Functions API Reference — ClientPulse AI

## 1. Overview & Authentication Rules

All backend logic in ClientPulse AI runs on **Supabase Edge Functions** (TypeScript on the Deno runtime). Every function has a single, well-defined responsibility.

### 1.1 Base URL
- **Local Development:** `http://localhost:54321/functions/v1`
- **Hosted Supabase:** `https://<project-ref>.supabase.co/functions/v1`

### 1.2 Authentication Schemes
1. **Authenticated User (`Bearer <JWT>`):**
   - The caller is an agency manager logged in via Supabase Auth.
   - The function extracts the user with `supabase.auth.getUser(token)`.
   - Used by: `github-sync`, `generate-report`, `approve-and-send`, `onboarding-chat`.
2. **Public Token-Gated (`?token=<UUID>`):**
   - The caller is an end client clicking a link from their email (`/portal?token=<UUID>`).
   - Does not require a login. The function verifies that the UUID exists in `clients.portal_token` using the internal `service_role` client.
   - Used by: `client-portal-data`.
3. **Internal Scheduled Dispatcher (`X-Scheduled-Secret` or `service_role`):**
   - Invoked exclusively by `pg_cron` (via `pg_net`) or local cron scripts.
   - Validates an internal shared secret to prevent unauthorized public invocation.
   - Used by: `dispatch-scheduled-reports`.

---

## 2. Shared Utilities (`supabase/functions/_shared/`)

To keep code clean and prevent duplicate logic, all Edge Functions import from `_shared/`:
- `_shared/cors.ts`: Standard CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Headers`, OPTIONS handling).
- `_shared/supabaseClient.ts`: Instantiates either a user-scoped Supabase client (respects RLS) or an admin client (`service_role`, bypasses RLS for portal/cron).
- `_shared/github.ts`: Reusable GraphQL client for GitHub Projects v2 queries.
- `_shared/gemini.ts`: Google Gemini API client with JSON schema validation.
- `_shared/resend.ts`: Transactional email sender with responsive HTML email templates.

---

## 3. Endpoints Specification

### 3.1 `POST /github-sync`
Connects to GitHub Projects v2 via GraphQL, verifies credentials, and lists available projects and status columns.

- **Caller:** Authenticated Agency User (`Authorization: Bearer <JWT>`).
- **Headers:**
  - `Authorization: Bearer <USER_JWT>`
  - `Content-Type: application/json`

#### Action: `test-connection`
Validates a personal access token before saving.
```json
// Request Body
{
  "action": "test-connection",
  "pat_token": "github_pat_11A..."
}

// Response (200 OK)
{
  "valid": true,
  "github_username": "maria-agency",
  "avatar_url": "https://avatars.githubusercontent.com/u/123456"
}
```

#### Action: `list-projects`
Lists all Projects v2 owned by a user or organization.
```json
// Request Body
{
  "action": "list-projects",
  "owner": "iscte-agile-team",
  "owner_type": "organization" // "organization" | "user"
}

// Response (200 OK)
{
  "projects": [
    {
      "id": "PVT_kwDOA123456",
      "number": 1,
      "title": "ClientPulse AI Development",
      "closed": false,
      "url": "https://github.com/orgs/iscte-agile-team/projects/1"
    }
  ]
}
```

#### Action: `fetch-columns`
Retrieves the status field options (columns) for column mapping.
```json
// Request Body
{
  "action": "fetch-columns",
  "project_id": "PVT_kwDOA123456"
}

// Response (200 OK)
{
  "field_id": "PVTF_lADOA123456",
  "field_name": "Status",
  "columns": [
    { "id": "f75ad910", "name": "Todo" },
    { "id": "47fc9ee4", "name": "In Progress" },
    { "id": "98236657", "name": "Blocked" },
    { "id": "2a9446d3", "name": "Done" }
  ]
}
```

#### Error Cases
- `400 Bad Request`: Missing `action` or `pat_token`.
- `401 Unauthorized`: Invalid GitHub PAT or expired Supabase JWT.
- `404 Not Found`: GitHub project or organization not found.

---

### 3.2 `POST /generate-report`
Fetches card metadata updated or completed in the last 7 days from GitHub Projects v2, prompts Gemini with client tone/language, validates the 3-block structure, and stores a `draft` report.

- **Caller:** Authenticated Agency User or Internal Batch Dispatcher.
- **Headers:**
  - `Authorization: Bearer <USER_JWT>`
  - `Content-Type: application/json`

#### Request Body
```json
{
  "client_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "custom_notes": "Emphasize that the authentication milestone is fully complete."
}
```

#### Response (201 Created)
```json
{
  "report_id": "8bb1b88e-6c61-4899-b1d3-35f9bc64e29f",
  "client_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "status": "draft",
  "period_start": "2026-10-13",
  "period_end": "2026-10-20",
  "blocks": {
    "done": "• Concluída a integração com a API GraphQL do GitHub Projects v2.\n• Criada a base de dados no Supabase com isolamento de dados por agência.\n• Desenvolvidas as rotas seguras para o portal de clientes.",
    "blockers": "• Aguarda aprovação das credenciais de envio de e-mail de teste no serviço transacional.",
    "next_steps": "• Finalizar a interface do utilizador no Google Stitch.\n• Realizar o teste com utilizadores reais na próxima sexta-feira."
  },
  "tasks_count": 8
}
```

#### Error Cases
- `400 Bad Request`: `client_id` is missing or invalid.
- `404 Not Found`: Client not found or has no linked GitHub project.
- `502 Bad Gateway`: GitHub API or Gemini API error.

---

### 3.3 `POST /approve-and-send`
Allows the agency manager to modify the draft text, marks the report as `approved`/`sent`, and sends an email to the client via Resend.

- **Caller:** Authenticated Agency User (`Authorization: Bearer <JWT>`).
- **Headers:**
  - `Authorization: Bearer <USER_JWT>`
  - `Content-Type: application/json`

#### Request Body
```json
{
  "report_id": "8bb1b88e-6c61-4899-b1d3-35f9bc64e29f",
  "updated_blocks": {
    "done": "• Concluída a integração com a API GraphQL do GitHub...\n• Adicionado suporte para testes automatizados.",
    "blockers": "• Nenhum bloqueio crítico esta semana.",
    "next_steps": "• Início dos testes com utilizadores finais."
  }
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "report_id": "8bb1b88e-6c61-4899-b1d3-35f9bc64e29f",
  "status": "sent",
  "sent_at": "2026-10-20T15:00:00Z",
  "email_delivery_id": "resend_msg_01JB...",
  "portal_url": "https://clientpulse.app/portal?token=d4b29596-f947-4972-965a-0824b0b8cbf0"
}
```

#### Error Cases
- `400 Bad Request`: Missing `report_id` or report is already sent.
- `403 Forbidden`: User does not own the agency that generated this report.
- `500 Internal Server Error`: Email delivery failure.

---

### 3.4 `GET /client-portal-data`
Public zero-login endpoint for the client portal. Validates the client's UUID token and returns the latest report, historical reports, and sprint delivery velocity.

- **Caller:** Public Client Web Browser (No login required).
- **Query Parameter:** `token` (Required UUIDv4).

#### Request Example
```http
GET /functions/v1/client-portal-data?token=d4b29596-f947-4972-965a-0824b0b8cbf0
```

#### Response (200 OK)
```json
{
  "client": {
    "name": "Maria Silva",
    "company_name": "Agência Criativa Lda"
  },
  "latest_report": {
    "id": "8bb1b88e-6c61-4899-b1d3-35f9bc64e29f",
    "period_start": "2026-10-13",
    "period_end": "2026-10-20",
    "summary_done": "• Concluída a integração com a API GraphQL...",
    "summary_blockers": "• Aguarda aprovação das credenciais...",
    "summary_next_steps": "• Finalizar a interface do utilizador...",
    "sent_at": "2026-10-20T15:00:00Z"
  },
  "history": [
    {
      "id": "7aa0a77d-5b50-3788-a0c2-24e8ab53d18e",
      "period_start": "2026-10-06",
      "period_end": "2026-10-13",
      "summary_done": "• Configuração inicial da arquitetura...",
      "sent_at": "2026-10-13T15:00:00Z"
    }
  ],
  "metrics": {
    "sprint_velocity": [
      { "period_end": "2026-10-13", "completed_tasks": 6 },
      { "period_end": "2026-10-20", "completed_tasks": 8 }
    ]
  }
}
```

#### Error Cases
- `400 Bad Request`: Missing or malformed UUID `token`.
- `404 Not Found`: Token not recognized or revoked.

---

### 3.5 `POST /dispatch-scheduled-reports`
Triggered periodically by `pg_cron` via `pg_net`. Scans for clients due in the current UTC hour, generates drafts, and auto-sends if `auto_send_enabled` is true.

- **Caller:** `pg_cron` / `pg_net` with `X-Scheduled-Secret: <SECRET>`.

#### Request Body
```json
{
  "target_day": 5, // 0 = Sun, 5 = Fri
  "target_hour_utc": 9
}
```

#### Response (200 OK)
```json
{
  "processed_clients": 3,
  "drafts_created": 2,
  "auto_sent": 1,
  "errors": []
}
```

---

### 3.6 `POST /onboarding-chat`
Conversational onboarding assistant. Powered by Gemini, it guides the user step-by-step through generating a GitHub PAT, tests the PAT in real time, and helps create their first client profile.

- **Caller:** Authenticated Agency User (`Authorization: Bearer <JWT>`).

#### Request Body
```json
{
  "message": "Aqui está o meu token do GitHub: github_pat_11A...",
  "conversation_history": [
    { "role": "assistant", "content": "Olá! Para começarmos, preciso que introduzas o teu Personal Access Token do GitHub." }
  ]
}
```

#### Response (200 OK)
```json
{
  "reply": "Excelente! Validei o teu token com sucesso para o utilizador @maria-agency. Encontrei 2 projetos ativos. Gostarias de associar o projeto 'Website Redesign' ao teu primeiro cliente?",
  "action_detected": {
    "action": "pat_validated",
    "data": {
      "github_username": "maria-agency",
      "projects_count": 2
    }
  }
}
```

---

## 4. Quick Testing via `curl`

Test your functions locally using these commands:

```bash
# 1. Test GitHub PAT validation
curl -X POST http://localhost:54321/functions/v1/github-sync \
  -H "Authorization: Bearer <YOUR_SUPABASE_ANON_OR_USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"action":"test-connection","pat_token":"github_pat_xxx"}'

# 2. Test Client Portal Public Access
curl -X GET "http://localhost:54321/functions/v1/client-portal-data?token=d4b29596-f947-4972-965a-0824b0b8cbf0"
```
