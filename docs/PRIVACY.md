# Privacy and data minimization — ClientPulse AI

Implementation notice reviewed on 2026-11-18. This describes observed code and remaining limitations; it is not a legal compliance certification or a claim about provider contracts.

## Data flow

The GitHub integration reads project/card metadata, not repository source files, commits or diffs. The GraphQL runtime allowlist is tested locally. Before report generation, `minimizeTaskForAI` selects task `title`, sanitized/truncated `description` (300 characters), `status`, `labels` and `assignee`. Source: [github.ts](../supabase/functions/_shared/github.ts) and [gemini.ts](../supabase/functions/_shared/gemini.ts).

Report prompts also contain client context (including name/company, tone and language), dates and manager notes. Onboarding sends chat content after recognized PAT masking. Titles, notes and descriptions are free text: removing code fences and selecting fields cannot guarantee that secrets, personal data or copied source code are absent. Users should avoid entering unnecessary sensitive information; the UI notices identify tasks, client context and chat as applicable.

## Services and information handled

| Service | Purpose and information | What has not been verified |
| --- | --- | --- |
| GitHub | PAT-authenticated project metadata reads | Exact private/org project permissions for each user's token |
| Google Gemini | Minimized task metadata, client context/notes and sanitized chat text | Account plan, retention, training use and region; consult the applicable account terms before handling real sensitive data |
| Supabase | Auth identity, agency/client records, reports, tokens, delivery/audit telemetry | Production retention/backups and complete tenant isolation were not tested in this audit |
| Resend | Recipient, report body and portal link | Real delivery and retention settings; existing authorized test configuration remains unchanged |
| Vercel | Next frontend/server routes | Production logs, retention and deployment configuration were not revalidated |

No blanket claim of “no training”, transient retention or TLS 1.3 across every service is made from code alone. Credentials and connection settings need appropriate server-side configuration.

## Credentials and access controls

- PATs are encrypted with AES-256-GCM using `PAT_ENCRYPTION_KEY`: 32 decoded bytes supplied as base64. Migration 007 introduces encrypted storage; migration 010 restricts credential-column reads. Legacy plaintext fallback remains in backend code; absence of plaintext rows in production was not established.
- Supabase service-role keys and encryption keys belong only on the server. Public anon keys rely on RLS and are not privileged secrets.
- Management functions validate user/agency or the scheduler secret. CORS does not authenticate non-browser clients.
- RLS is enabled and the `success_metrics` view is security-invoker. Separate agency/client/report foreign keys still allow integrity concerns that require real database tests and a reviewed composite-key migration.
- The Next email webhook verifies its signature; the separate legacy tracking function needs additional protection. See [FINAL_AUDIT.md](FINAL_AUDIT.md).

## Legacy tracking security change — staged, not deployed (2026-11-18)

The legacy Supabase Edge Function `email-tracking` previously used a service-role client to change report-open timestamps based on caller-provided report identifiers, portal-token strings and even timestamps. The code in branch `security/retire-legacy-email-tracking` removes **all database writes** from that legacy endpoint: GET still returns a 1×1 GIF but does **not** log an open; POST returns HTTP 410. It also does not change the existing Resend configuration, the signed Next.js webhook or the separate Next.js tracking pixel.

**Deployment separation:** the hosted `email-tracking` v9 was not modified by this source-only security change. An authorized maintainer must verify that no external integration depends on the old endpoint, run regression and gateway/JWT checks, and separately approve publishing only this function in an isolated environment before production. Existing open-rate estimates may be affected; this change is a security trade-off, not proof that replacement tracking writes persist under real RLS. See [technical audit](FINAL_AUDIT.md) and [API reference](API.md).

## Portal links and opens

Portal links use randomly generated UUIDv4 tokens (122 random bits in a 128-bit UUID), separate from the client ID. Anyone possessing a valid link can read the published report. New links default to 90 days; the data RPC still accepts legacy NULL expiry. Inactive/revoked/expired links are rejected, and only sent report text is returned. Broader client metadata and metrics remain a minimization concern.

Renewal first revokes the old token and then issues the replacement. Revocation errors now stop issuance, but the multi-write operation is not transactional. Email token upserts also need a lifecycle review. Do not publish production portal URLs in GitHub, screenshots or logs.

First-open telemetry is not proof of human receipt: server rendering, metadata fetches, link previews and mail clients can produce opens. Anonymous webhook/pixel writes have separate RLS limitations.

## Optional voice and human review

Web Speech recognition depends on browser capability and permission. ClientPulse does not implement audio recording/storage; a browser vendor may process speech using its own service and terms. Transcribed text is placed in the input for review rather than automatically sent. Text input remains available.

Reports default to drafts for manual review. Explicitly enabling automatic sending bypasses this review when AI succeeds; deterministic fallback forces a draft. Prompts and schemas reduce hallucination risk but do not prove factual accuracy.

## Evidence and contact

Screenshots and E2E fixtures use synthetic `example.test` identities and dummy UUIDs, clearly labelled as tests. No real provider credentials or production data are required. Real-use metrics remain [unmeasured](RESULTADOS.md).

For access/deletion questions contact the team through the [project repository](https://github.com/cabrito33/ClientPulse-AI), without posting personal data or valid tokens in public issues. Related: [architecture](ARCHITECTURE.md), [database](DATABASE.md), [testing](TESTING.md).
