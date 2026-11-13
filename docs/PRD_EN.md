# Product Requirements Document (PRD) — ClientPulse AI

**Project:** ClientPulse AI — Weekly Progress Reports for Freelancers and Agencies  
**Team:** [Team name / Team members]  
**GitHub repository:** [Link to the repository] (diogocosme added as collaborator)  
**Version:** 2.1 (Aligned with Validation Report, Mentor Architecture, and Backend Decisions)

---

## 1. Executive Summary & Overview (TL;DR)

### 1.1 Product and Company Name
ClientPulse AI (B2B SaaS).

### 1.2 Product / Service Description
ClientPulse AI is a SaaS platform that automates the generation and delivery of weekly progress reports to clients. It connects directly to GitHub Projects v2 (the single data source in the MVP), extracts the week's completed tasks, blockers, and next steps, and uses artificial intelligence (Google Gemini) to write an executive report in clear business language without technical jargon.

Delivery is scheduled (weekly by default), with prior review and approval by the professional before it is sent, or optional automatic direct sending. The client receives an email with the executive summary and a secure link to the Client Portal (read-only, no login required) to view history and simple delivery metrics. The platform also includes a Conversational Assistant (Chatbot/Voice Bot) to guide the professional through onboarding and answer usage questions.

### 1.3 Customer Segment (Target Audience)
- **Primary segment:** Owners and managers of small digital agencies (2 to 10 people) in web development, design, and marketing.
- **Secondary segment:** Freelancers and senior independent consultants who manage 2 to 5 mid-to-high-ticket clients at the same time.

### 1.4 Scope and Phases (MVP vs. Future Evolution)

**MVP Scope (5-Week Project Deliverable):**
- Exclusive integration with the GitHub Projects v2 GraphQL API using Personal Access Tokens (PAT).
- AI report generation via Google Gemini (3 mandatory blocks: Completed, Blockers/Attention, Next Steps).
- Manual approval flow by the professional, with a configurable option for automatic sending (bypass).
- Scheduled email delivery (via Resend) with a secure, permanent UUID link to the zero-login Client Portal.
- Agency dashboard for report editing, client management, and sprint tracking.
- Conversational onboarding assistant (Chatbot/Voice Bot) restricted to onboarding (account setup and GitHub connection) and FAQ/Support. Voice is handled via the browser Web Speech API.

**Future Evolution (Outside the MVP):**
- Integrations with Trello, Notion, and Jira.
- Full GitHub OAuth 2.0 Web Flow.
- Formal micro-approvals of deliverables by the client directly in the portal.
- Multi-user agency teams with role-based access control (RBAC).
- Credential-based authentication (login) for the end client.

---

## 2. User Experience Story

Maria is a manager at a small 4-person web development agency that handles 5 clients at the same time. On Fridays, Maria used to spend more than 3 hours manually compiling task status from GitHub, answering anxious client messages on Slack/WhatsApp, and translating technical language into status emails.

After adopting ClientPulse AI, Maria completes onboarding in under 5 minutes: a Voice/Chat Assistant guides her through connecting the agency's GitHub account (via PAT), selecting the project board, and creating her clients' profiles.

On Friday at 09:00, the system compiles the GitHub Projects activity and the AI automatically generates a draft executive report in Portuguese. Maria receives an alert on the Dashboard, reads the summary in 2 minutes, makes a small adjustment, and clicks "Approve and Send".

The client receives a professional email with the summary and a secure link to the Client Portal, where they see the week's progress and the chart of tasks completed per sprint, without creating an account or memorizing credentials. Maria reduces report management time by more than 80% and eliminates client anxiety.

---

## 3. Goals Framework

### Business Goals
- **Drastic reduction of non-billable time:** Reduce the time spent writing reports from 3–6 hours/week to under 10 minutes per client (including review).
- **Real-use proof:** Use the academic team's own GitHub Project to manage development and validate reports in real time.
- **Retention and trust:** Increase transparency with clients, reducing interim status requests.

### User Goals
- **Professional (Agency/Freelancer):** Centralize and automate accountability while keeping full control before the email goes out.
- **End Client:** Understand the value delivered each week in clear, executive language, without technical noise or complicated sign-ups.

### Non-Goals (MVP Boundaries)
- Do not allow bidirectional task editing or management from the Client Portal.
- Do not analyze or store repository source code (strictly limited to GitHub Projects card/issue metadata).
- Do not support multiple data sources (Trello/Notion) in this MVP phase.
- Do not implement complex multi-user agency workspaces; 1 Supabase Auth user = 1 Agency workspace.

---

## 4. User Stories & Acceptance Criteria

### US01 — Connect to GitHub Projects (MVP, High Priority)
*As an agency manager / freelancer,*  
*I want to connect my account and select my GitHub Project,*  
*So that the system can automatically extract completed, blocked, and in-progress tasks.*

**Acceptance Criteria:**
- The user can configure a GitHub Fine-Grained Personal Access Token (PAT) with `read:project` and `repo` read-only scope.
- The system validates the token and lists available user and organization Projects v2.
- The user can map which board columns correspond to "Done", "In Progress", and "Blocked".

### US02 — Assisted Onboarding via Chatbot/Voice Bot (MVP, Medium Priority)
*As a new user,*  
*I want to be guided by a conversational assistant (text or voice) on first access,*  
*So that I can set up the account, connect GitHub, and create the first client in under 5 minutes.*

**Acceptance Criteria:**
- The bot activates automatically on first login.
- It accepts text input (or voice input via browser Web Speech API) to answer support questions and guide setup.
- The bot validates that the GitHub connection works before moving on.

### US03 — Client Profile Setup (MVP, High Priority)
*As a professional,*  
*I want to register my client's details (name, email, communication tone, and language),*  
*So that AI-generated reports are personalized to each client's style.*

**Acceptance Criteria:**
- Native support for Portuguese and English.
- Communication tone options: Formal, Executive, or Casual.
- Configurable delivery schedule (e.g., every Friday at 09:00 UTC).
- Option to toggle automatic sending without manual review (`auto_send_enabled`).

### US04 — AI Draft Generation and Approval (MVP, High Priority)
*As a professional,*  
*I want to receive an AI-generated report draft and be able to edit/approve it before sending,*  
*So that I can guarantee the accuracy of the information and avoid AI hallucinations.*

**Acceptance Criteria:**
- The draft is mandatorily structured in 3 blocks: What was done, Blockers/Attention, and Next Steps (Decisions).
- The user can edit the text directly in a Markdown/text editor.
- Includes an "Approve and Send" button and support for automatic bypass sending.

### US05 — Client Portal without Login (MVP, High Priority)
*As an end client,*  
*I want to access my report and history through a secure link sent by email,*  
*So that I can check the project status without creating an account or memorizing credentials.*

**Acceptance Criteria:**
- Email links contain a unique, non-guessable client UUID token (`/portal/<CLIENT_UUID>`).
- The page is strictly read-only, showing the week's report, previous history, and a simple chart of tasks completed per sprint.

---

## 5. Core Features (Prioritized Feature Set — MoSCoW)

| Feature | MoSCoW Priority | Module | Description |
| :--- | :--- | :--- | :--- |
| **Agency Workspace & Auth** | **Must Have** | Backend / Auth | Supabase Auth email/password, auto-provisioning of agency record, strict RLS isolation. |
| **GitHub Projects v2 Sync** | **Must Have** | GitHub Integration | GraphQL integration supporting user & org boards, status mapping, and 7-day completion window. |
| **Client Profile Management** | **Must Have** | Database / API | Client CRUD, delivery schedules, tone, language, and unique portal token generation. |
| **Gemini AI Report Generator** | **Must Have** | AI Engine | Strict anti-hallucination prompt, 3-block structured JSON output, validation before saving. |
| **Report Review & Approval** | **Must Have** | Backend / API | Draft editing, manual approval ("Approve & Send"), and bypass option. |
| **Transactional Email Dispatch** | **Must Have** | Automation / Email | Resend integration with clean HTML template linking to the client portal. |
| **Zero-Login Client Portal API** | **Must Have** | Client Portal | Token-authenticated public Edge Function returning latest report, history, and delivery metrics. |
| **Scheduled Batch Dispatcher** | **Must Have** | Automation | `pg_cron` calling Edge Function via `pg_net` to trigger weekly draft generation and auto-sends. |
| **Conversational Onboarding Bot** | **Must Have** | AI / Onboarding | Gemini-powered assistant with token validation tool; browser Web Speech API for voice. |
| **Local Dev Mock Email Mode** | **Should Have** | Automation / Email | Prevents failure when testing without a verified custom domain on Resend. |
| **Full GitHub OAuth 2.0 Web Flow** | *Won't Have (MVP)* | Future Evolution | Deferred to post-MVP to keep setup simple for a small student team. |
| **Client Micro-Approvals** | *Won't Have (MVP)* | Future Evolution | Formal sign-off on deliverables inside the portal. |
| **Multi-Source Integrations** | *Won't Have (MVP)* | Future Evolution | Trello, Notion, Jira integrations. |

---

## 6. Competitive Landscape & Market Gaps

- **Briefd:** Lets professionals structure reports in 3 blocks, but requires 100% manual writing. *ClientPulse AI differentiator:* Automatic collection from GitHub Projects and AI synthesis.
- **AgencyAnalytics / DashThis:** Focuses on marketing metrics (SEO/PPC) at \$20–\$25/client/month. *ClientPulse AI differentiator:* Qualitative engineering and design deliverables.
- **Copilot (Assembly) / ManyRequests:** Expensive full client portals (\$39–\$99/month). *ClientPulse AI differentiator:* Zero client login friction and zero-configuration AI reports.
- **Notion / Taskade Templates:** Require manual copying and lack isolated client portals or automated scheduled sending.

---

## 7. Success Metrics and Failure Criteria

### 7.1 Measurable Success Metrics
- **Onboarding time:** Connect the GitHub Project and generate the 1st report in under 5 minutes with the bot's help.
- **Weekly preparation time:** Reduce report preparation time to under 10 minutes per client/week (including review).
- **AI accuracy:** More than 80% of GitHub Projects tasks correctly reflected in the report; at least 80% of approved drafts require fewer than 3 manual edits.
- **Zero-hallucination rate:** 0% invented tasks or fabricated metrics in production reports.

### 7.2 Failure Criteria (Stop or Pivot Signals)
- **Prompt/AI failure:** If more than 50% of reports require total manual rewriting due to hallucinations or lack of technical context.
- **Onboarding failure:** If fewer than 50% of test users manage to connect GitHub without direct human intervention from the team.

---

## 8. Technical Considerations & Security

- **APIs & Connectivity:** GitHub GraphQL API for Projects v2. Fine-Grained Personal Access Tokens stored securely.
- **AI Model:** Google Gemini API (`gemini-2.5-flash` or `gemini-1.5-flash`) via Supabase Edge Functions with structured JSON schemas and strict temperature controls.
- **Data Privacy & Security:**
  - *No Code Access:* Only task metadata (title, description, status, assignees, labels) is processed. Repository source code is never read or stored.
  - *Row Level Security (RLS):* Enabled on every table. Users can only access data belonging to their own agency.
  - *Secrets:* All API keys (Gemini, GitHub, Resend) are stored in Supabase Secrets / `.env`, never committed to git.
  - *Client Portal:* Protected by high-entropy UUIDv4 tokens. The portal does not query Postgres directly; it calls a dedicated token-validating Edge Function.

---

## 9. Technical Decisions Log

- **[2026-10-13] MVP Stack:** Supabase (PostgreSQL, Auth, Edge Functions) + React/Next.js frontend + Google Gemini API + Resend email service.
- **[2026-10-20] Data Source Scope:** Restricted to GitHub Projects v2 via GraphQL; fine-grained PAT selected over OAuth to ensure fast, reliable local development for a 1–2 person backend team.
- **[2026-10-20] Client Portal Token Model:** Permanent, revocable UUID token per client. Allows seamless access to current reports and historical archive without requiring client logins.
- **[2026-10-20] Scheduling Architecture:** Unified periodic `pg_cron` job executing a Supabase Edge Function via `pg_net` to evaluate due reports in UTC.

---

## 10. Calendar and Milestones (5 Weeks)

- **Week 1: Alignment, Architecture & Planning (Current)**
  - PRD consolidation, architecture diagrams, database schema design, API contract, and GitHub Issues breakdown.
- **Week 2: Database Schema & GitHub GraphQL Integration**
  - Supabase migrations, RLS security policies, seed data, and Edge Functions for GitHub Projects v2 data extraction.
- **Week 3: AI Report Generator & Dashboard Backend**
  - Gemini prompt engineering, structured JSON validation, 3-block executive synthesis, and draft review/approval endpoints.
- **Week 4: Scheduling, Email Dispatch & Client Portal**
  - Resend email integration, `pg_cron` automated Friday dispatcher, and zero-login Client Portal data endpoint.
- **Week 5: Conversational Onboarding Assistant, Testing & Polish**
  - Gemini onboarding chat function with token validation tool, end-to-end testing, and academic project demo readiness.
