# API reference — ClientPulse AI

Source-reviewed on 2026-11-18. These are implementation contracts, not results of live provider tests. Edge Functions live under [supabase/functions](../supabase/functions); browser calls use [edge.ts](../src/lib/edge.ts), with server actions under [actions](../src/app/actions).

## Authentication and common behaviour

The deployed base is `https://<PROJECT_REF>.supabase.co/functions/v1`. Management endpoints validate a Supabase bearer JWT and agency ownership. Internal generation/dispatch can use `X-Scheduled-Secret`; never place this secret in browser code. CORS does not authenticate callers. JSON error bodies normally contain `error`; wrong methods return 405, missing inputs 400, invalid identity 401, missing/inaccessible resources 404. Unhandled errors return 500. Inspect each function for specific exceptions below.

Examples use placeholders and describe schemas; none is evidence of a real request or email delivery.

## POST github-sync

[Implementation](../supabase/functions/github-sync/index.ts). Body uses `action` and action-specific arguments. A supplied PAT or the agency's stored encrypted PAT is used server-side.

| Action | Inputs | Successful result |
| --- | --- | --- |
| `test-connection` | `pat_token` or stored credential | `valid`, `username`, `name`, `avatarUrl` |
| `save-pat` | `pat_token` | `success`, `username`; persists encrypted credential |
| `list-projects` | optional `owner`, `owner_type` | `owner`, `projects` |
| `fetch-columns` | `project_id` | `fieldId`, `fieldName`, `columns` |
| `fetch-board-data` | `project_id`, optional `column_mapping`, `days_ago` | categorized task data from GitHub helper |
| `sync-metrics` | `client_id` | `success`, client/sprint information and `tasks_count` |

Classic `read:project`/`repo` scopes and fine-grained token permissions are distinct. A valid identity alone does not prove access to every private or organization project. GraphQL rate limits are handled separately from invalid credentials. The runtime allowlist prevents repository-file queries.

## POST generate-report

[Implementation](../supabase/functions/generate-report/index.ts). Accepts user JWT or scheduled secret. Body: required `client_id`; optional `period_days`, `custom_notes`, `bypass_approval`.

A successful request returns **201**, including deterministic fallback:

```json
{
  "success": true,
  "report_id": "<REPORT_UUID>",
  "client_id": "<CLIENT_UUID>",
  "status": "draft",
  "auto_sent": false,
  "generated_without_ai": false,
  "period": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
  "blocks": { "done": "...", "blockers": "...", "next_steps": "..." },
  "sprint_metric": { "sprint": "Snn", "label": "Semana nn", "completed": 0, "planned": 0 },
  "tasks_count": { "total": 0, "done": 0, "in_progress": 0, "blocked": 0, "ignored": 0 },
  "unmapped_columns": [],
  "ignored_tasks_count": 0
}
```

AI failure produces a raw structured draft and disables automatic sending; it does not inherently return 502. Other dependencies can still fail. GitHub rate limits return 429 with `code: GITHUB_RATE_LIMITED`. A matching draft can be updated. Weekly checks are not atomic delivery guarantees. Metrics currently use Snn without a year.

## POST approve-and-send

[Implementation](../supabase/functions/approve-and-send/index.ts). Requires user JWT. Body: `report_id`, optional `updated_blocks` containing `done`, `blockers`, `next_steps`. Subject and introduction edits in the current UI are not represented by this three-block contract.

Success **200**: `success`, `report_id`, `status: sent`, `sent_at`, `email_delivery_id`, `is_mock_delivery`, `mock`, `portal_url`. The actual Resend helper does not turn missing credentials or rejected deliveries into mock success. Test fixtures explicitly substitute this endpoint and may return a mock flag.

Send failure returns **502** and records failure details. Inaccessible report returns **404**. There is no guaranteed 409 for an already-sent report: repeated/concurrent calls can send again. Token upsert and delivery/persistence are not a single transaction. See [audit risks](FINAL_AUDIT.md).

## POST dispatch-scheduled-reports

[Implementation](../supabase/functions/dispatch-scheduled-reports/index.ts). Requires `X-Scheduled-Secret` (403 if absent/invalid). Optional JSON `target_day` and `target_hour_utc` override the evaluated UTC window for controlled testing. The dispatcher considers **all clients in that window**, not a single selected client.

Result **200** contains `evaluated_time`, `total_clients_found`, `drafts_created`, `auto_sent`, `skipped_duplicate`, `details`, and `errors` (an array of client/error objects). `drafts_created` counts newly persisted reports including automatic sends. No due clients adds a `message`. A 200 may contain per-client errors, so inspect the array.

A prior report in the ISO week can be skipped. Concurrent invocations can both pass the lookup, and sending before persistence creates a retry risk. There is no durable retry queue or exactly-once guarantee.

## GET client-portal-data?token=<TOKEN>

[Implementation](../supabase/functions/client-portal-data/index.ts). Public handler validates UUID format and calls `get_portal_data_by_token`. Returns 400 for missing/malformed token, 404 for invalid/expired/revoked token, 500 for RPC failure.

Success **200**, `Cache-Control: no-store`: `client` (`name`, `company_name`, `language`), `latest_report`, `history` (excluding the latest), and `metrics` (`total_reports`, `sprint_velocity`). Only sent report text is published. Velocity entries use `sprint`, `label`, `completed`, `planned`.

The web route `/portal/[token]` uses Next SSR with the RPC directly, rather than fetching this Edge endpoint. Its history list includes the current sent report. Legacy NULL expiry is still accepted by the data RPC; open recording is stricter. This is a bearer link: possession grants access, so never publish real tokens.

## POST onboarding-chat

[Implementation](../supabase/functions/onboarding-chat/index.ts). Requires user JWT. Receives `message` and optional `history`. Detects/validates PAT input, masks token content before AI prompting and can use deterministic FAQ fallback.

Result **200**: `reply`, `action_detected` (`action`, optional `data`), `github_status` (`is_connected`, `username`). Actions include `pat_validated`, `pat_failed`, `awaiting_client_details`, `awaiting_pat`. No provider availability is established by the local fixture responses.

## Tracking endpoints and limitations

| Endpoint | Behaviour | Boundary |
| --- | --- | --- |
| Next `GET /api/track/open` | Tracking GIF; server timestamp | User-scoped DB client may fail anonymous RLS; pixel fetch is not proof of human reading |
| Next `POST /api/webhooks/resend` | Verifies Svix HMAC signature and event | Signature tests do not prove database persistence under RLS |
| Edge `email-tracking` GET/POST | Legacy service-role tracking by report/token/event | Separate from signed Next webhook; lacks equivalent handler authentication/signature checks, and accepts supplied timestamp on POST. Do not treat as a secure alternative |
| SQL `record_portal_report_open` | Token-validated sent-report update | Requires active, unrevoked, future-expiry token; portal metadata/previews can trigger it |

No Resend settings, webhook subscriptions or production permissions were changed. Local regressions, browser fixtures and unexecuted SQL checks are distinguished in [TESTING.md](TESTING.md).
