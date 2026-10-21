# GitHub Issues Backlog — ClientPulse AI (Backend & Database)

> **Team Context:** This task list is prioritized and sized specifically for a **1–2 person backend team** across the 5-week course sprint. Each issue includes copy-pasteable acceptance criteria, labels, and estimated effort (`S` = 1–3 hours, `M` = 4–8 hours, `L` = 1–2 days).
>
> **Dependency Order:** Complete issues in the numbered order below to avoid blockers.

---

## Week 1: Architecture, Planning & Documentation (Current)

### Issue #01: System Architecture, PRD Consolidation & API Specifications
- **Labels:** `docs`, `backend`, `security`
- **Size:** `M`
- **Week:** Week 1
- **Dependencies:** None
- **Description:**  
  Document the complete system architecture, data flow diagrams, threat model, API contracts, and database schema in `/docs` to establish team consensus before writing code.
- **Acceptance Criteria:**
  - [x] `docs/PRD.md` updated with completed Section 5 MoSCoW feature matrix and technical decisions.
  - [x] `docs/ARCHITECTURE.md` created with Mermaid diagrams, data flows, and risk mitigations.
  - [x] `docs/DATABASE.md` created with complete data dictionary and RLS guide.
  - [x] `docs/API.md` created with request/response schemas for all 6 Edge Functions.
  - [x] All docs reviewed and approved by teammates.

---

## Week 2: Database Schema & GitHub GraphQL Integration

### Issue #02: Supabase Initial Migration, RLS Policies & Seed Data
- **Labels:** `database`, `security`
- **Size:** `M`
- **Week:** Week 2
- **Dependencies:** Issue #01
- **Description:**  
  Implement the PostgreSQL database schema in `supabase/migrations/001_initial_schema.sql`. Enable Row Level Security (RLS) on all tables (`agencies`, `github_integrations`, `clients`, `reports`, `report_tasks`). Include a seed script with mock data for local testing.
- **Acceptance Criteria:**
  - [ ] Migration creates all 5 tables with proper foreign keys, constraints, and cascading deletes.
  - [ ] RLS policies enabled and verified: User B cannot query or mutate User A's agencies, clients, or reports.
  - [ ] Indexes created for `agency_id`, `portal_token`, and schedule columns.
  - [ ] Seed script executes successfully and populates test records.
  - [ ] `.env.example` and `.gitignore` updated to prevent committing secrets.

### Issue #03: Shared Utilities & CORS Middleware for Edge Functions
- **Labels:** `backend`
- **Size:** `S`
- **Week:** Week 2
- **Dependencies:** Issue #02
- **Description:**  
  Create reusable helper modules in `supabase/functions/_shared/` for CORS handling, user-context Supabase client instantiation, and admin `service_role` client access.
- **Acceptance Criteria:**
  - [ ] `_shared/cors.ts` exports clean CORS headers and handles HTTP `OPTIONS` preflight requests.
  - [ ] `_shared/supabaseClient.ts` provides helpers to extract and authenticate callers via JWT.
  - [ ] Local tests confirm headers prevent browser CORS errors.

### Issue #04: GitHub Projects v2 GraphQL Connector (`github-sync`)
- **Labels:** `backend`, `github`
- **Size:** `L`
- **Week:** Week 2
- **Dependencies:** Issue #03
- **Description:**  
  Build the `github-sync` Edge Function to authenticate GitHub Fine-Grained Personal Access Tokens (PAT), query GitHub Projects v2 via GraphQL for both user and organization owners, and fetch board columns.
- **Acceptance Criteria:**
  - [ ] `action: test-connection` validates the PAT and returns the GitHub username and avatar.
  - [ ] `action: list-projects` queries the GraphQL API and returns active Projects v2.
  - [ ] `action: fetch-columns` returns the project's single-select status field options.
  - [ ] GraphQL queries handle errors gracefully (401 Bad Credentials, 404 Project Not Found).

---

## Week 3: AI Report Generation Engine & Approval Flow

### Issue #05: Google Gemini Report Synthesis Function (`generate-report`)
- **Labels:** `ai`, `backend`
- **Size:** `L`
- **Week:** Week 3
- **Dependencies:** Issue #04
- **Description:**  
  Implement the `generate-report` Edge Function using Google Gemini (`gemini-2.5-flash`). The function pulls tasks updated or closed in the last 7 days from GitHub Projects v2, constructs a strict anti-hallucination prompt, validates the structured JSON response, and saves a `draft` in the database.
- **Acceptance Criteria:**
  - [ ] Fetches cards from GitHub GraphQL filtering by the 7-day window.
  - [ ] Prompt enforces the mandatory 3-block output: *What was done*, *Blockers/Attention*, *Next steps (Decisions)*.
  - [ ] Supports output in Portuguese and English, adapting to Formal, Executive, and Casual tones.
  - [ ] Strict anti-hallucination instruction: reports zero tasks if none were updated.
  - [ ] Stores report record with `status: 'draft'` and populates `report_tasks` for sprint metrics.

### Issue #06: Report Review & Approval Endpoint (`approve-and-send`)
- **Labels:** `backend`
- **Size:** `M`
- **Week:** Week 3
- **Dependencies:** Issue #05
- **Description:**  
  Build the `approve-and-send` Edge Function allowing agency managers to review, adjust, and approve draft reports. Prepares the payload for email dispatch and updates report status to `approved`.
- **Acceptance Criteria:**
  - [ ] Verifies the caller owns the agency that generated the report.
  - [ ] Allows editing the text of the 3 blocks before sending.
  - [ ] Updates report status to `approved` and records `approved_at`.
  - [ ] Validates that an already-sent report cannot be re-approved without intentional action.

---

## Week 4: Email Dispatch, Client Portal & Automation

### Issue #07: Transactional Email Integration with Resend
- **Labels:** `automation`, `backend`
- **Size:** `M`
- **Week:** Week 4
- **Dependencies:** Issue #06
- **Description:**  
  Build `_shared/resend.ts` to dispatch responsive HTML emails to clients. Include a local mock/preview mode to support testing without a verified custom domain.
- **Acceptance Criteria:**
  - [ ] Generates clean, responsive HTML email containing the 3 summary blocks and the Client Portal link.
  - [ ] Sends real emails via Resend API when API key is provided.
  - [ ] Falls back to local logging / mock preview if running in test mode or with an unverified domain.
  - [ ] Records `sent_at` and `email_delivery_id` in the `reports` table.

### Issue #08: Zero-Login Client Portal Data Endpoint (`client-portal-data`)
- **Labels:** `backend`, `security`
- **Size:** `M`
- **Week:** Week 4
- **Dependencies:** Issue #02
- **Description:**  
  Create the public `/client-portal-data` Edge Function that accepts `?token=<CLIENT_UUID>` and returns client info, the latest report, historical reports, and sprint delivery velocity.
- **Acceptance Criteria:**
  - [ ] Validates the token against `clients.portal_token` using internal `service_role`.
  - [ ] Returns `404 Not Found` for invalid or missing tokens without leaking error details.
  - [ ] Returns latest report, past reports list, and tasks completed per sprint.
  - [ ] Strictly read-only; no client-side mutations permitted.

### Issue #09: Automated Weekly Dispatcher via `pg_cron` & `pg_net`
- **Labels:** `automation`, `database`
- **Size:** `M`
- **Week:** Week 4
- **Dependencies:** Issue #05, Issue #07
- **Description:**  
  Configure a periodic `pg_cron` job calling `dispatch-scheduled-reports` via `pg_net`. Scans clients whose schedule matches the current time, triggers report generation, and auto-sends if `auto_send_enabled` is true.
- **Acceptance Criteria:**
  - [ ] `pg_cron` schedule executes periodically (e.g. hourly or every Friday at 09:00 UTC).
  - [ ] Calls `dispatch-scheduled-reports` securely using a shared secret or service key.
  - [ ] Generates drafts for all matching clients; dispatches email immediately if `auto_send_enabled = true`.
  - [ ] Handles errors per client without aborting the batch run.

---

## Week 5: Onboarding Assistant, Testing & Demo Readiness

### Issue #10: Gemini Conversational Onboarding Assistant (`onboarding-chat`)
- **Labels:** `ai`, `backend`
- **Size:** `L`
- **Week:** Week 5
- **Dependencies:** Issue #04
- **Description:**  
  Build the `onboarding-chat` Edge Function to guide first-time agency users through setup. The assistant helps generate a GitHub PAT, verifies the PAT via a validation tool, lists project boards, and assists in creating the first client.
- **Acceptance Criteria:**
  - [ ] Supports interactive multi-turn conversation in Portuguese and English.
  - [ ] Detects PATs in user messages, tests connection, and informs the user of success or failure.
  - [ ] Guides client profile creation (tone, language, schedule).
  - [ ] Web Speech API on the frontend connects seamlessly to this backend endpoint.

### Issue #11: End-to-End Real-Use Validation on Team Repository
- **Labels:** `backend`, `docs`
- **Size:** `M`
- **Week:** Week 5
- **Dependencies:** Issue #01 through #10
- **Description:**  
  Validate the entire system end-to-end using the team's own GitHub Project for the academic course. Generate, approve, and send a live progress report to teammates and professor Diogo Cosme.
- **Acceptance Criteria:**
  - [ ] Real tasks from the team's GitHub Project board synthesized into a live report.
  - [ ] Email received with a valid token link.
  - [ ] Client Portal loads correctly, displaying current progress and historical metrics.
  - [ ] Final architecture documentation and walkthrough prepared for the course demo.
