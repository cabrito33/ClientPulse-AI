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

[Implementation](../supabase/functions/generate-report/index.ts). Accepts user JWT or scheduled secret. Body: required `client_id`; optional `period_days`, `custom_notes`, `bypass`.

The handler reads `body.bypass`: when supplied, it overrides `client.auto_send_enabled`; when omitted, the client setting applies. Send a JSON boolean (`false` to force manual review), not a string: the code uses `Boolean(body.bypass)`, so the string `"false"` is truthy. `bypass_approval` is not a supported alias and is ignored. Even with `bypass: true`, AI fallback or empty content prevents automatic sending.

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

### Manual publication and smoke test after PR #60 is merged

**Deployment gap, reported by the project owner on 2026-11-18:** the hosted `generate-report` is still version 31 and references undefined `currentIso.week`. The branch fixes this with `getIsoWeekYear(periodEnd).week`, imported from `_shared/idempotency.ts`. Local tests and GitHub CI do not publish this correction to Supabase. Version 31 was not independently inspected during this documentation update; remote deployment and smoke-test results remain pending.

**Prepare the complete bundle.** After a human merges PR #60, use a clean checkout of the resulting `Main` commit and record its SHA. From the repository root, preserve these relative paths from that same commit:

- [generate-report/index.ts](../supabase/functions/generate-report/index.ts) — entrypoint and corrected week calculation.
- [_shared/idempotency.ts](../supabase/functions/_shared/idempotency.ts) — exports `getIsoWeekYear` and `findExistingWeekReport`.
- [_shared/cors.ts](../supabase/functions/_shared/cors.ts), [_shared/supabaseClient.ts](../supabase/functions/_shared/supabaseClient.ts), [_shared/github.ts](../supabase/functions/_shared/github.ts), [_shared/gemini.ts](../supabase/functions/_shared/gemini.ts), [_shared/crypto.ts](../supabase/functions/_shared/crypto.ts) and [_shared/resend.ts](../supabase/functions/_shared/resend.ts) — existing imports required by the entrypoint. `gemini.ts` also imports a type from `github.ts`; `supabaseClient.ts` imports `npm:@supabase/supabase-js@2`.
- [supabase/config.toml](../supabase/config.toml) — retain the checked-in configuration. Do not change secrets or authentication settings for this fix.

Deploy from the full checkout so the CLI includes the imported shared modules. Do not paste `index.ts` alone into a dashboard editor. Including the unchanged `resend.ts` dependency is necessary to resolve imports; it does not require changing Resend configuration or deploying other functions. Before proceeding, compare the existing function's JWT-verification setting with the intended deployment configuration; stop for review if they differ rather than silently changing authentication.

**CLI verification, 2026-11-18.** Supabase CLI **3.1.0** was found in the existing npm cache, although it is not on PATH or installed as a repository dependency. Its actual `--version`, `functions deploy --help`, `functions list --help` and `functions serve --help` were executed. Both hosted commands support `--remote=<ref|branch>`; deploy supports `--use-api` (server-side bundling without Docker). This matches the official reference linked below. No CLI upgrade or dependency installation was performed. Unversioned `npx` looked for a different release and did not resolve the cached installation; use the verified entrypoint below rather than silently downloading another version.

**Publish only this function, manually.** An authorized operator must select the actual project reference and authenticate the CLI outside repository files. This PowerShell example uses the exact cached entrypoint verified on this workstation. On another machine, locate the installed CLI, record its version and check its own help before adapting the invocation. The cache path may disappear; stop if it is absent. Only version/help commands have been executed, not list, deploy or remote invocation.

```powershell
# Run only after the human merge and deployment decision, from the merged checkout.
$cliEntry = Join-Path $env:LOCALAPPDATA 'npm-cache/_npx/aa8e5c70f9d8d161/node_modules/supabase/dist/supabase.js'
if (-not (Test-Path -LiteralPath $cliEntry)) { throw 'Verified CLI entrypoint missing; locate and verify the installed CLI first' }
$cliVersion = (node $cliEntry --version | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $cliVersion -ne '3.1.0') { throw 'CLI version changed; review its help before deployment' }
git status --short
git rev-parse HEAD
$projectRef = Read-Host 'Confirmed target Supabase project reference'
if ([string]::IsNullOrWhiteSpace($projectRef)) { throw 'Explicit target required' }
node $cliEntry functions list "--remote=$projectRef"
if ($LASTEXITCODE -ne 0) { throw 'Pre-deployment inspection failed' }
node $cliEntry functions deploy generate-report "--remote=$projectRef" --use-api
if ($LASTEXITCODE -ne 0) { throw 'Deployment failed; inspect before retrying' }
node $cliEntry functions list "--remote=$projectRef"
```

Check the displayed target before confirming the hosted change. Do not add `--no-verify-jwt`, `--prune` or omit the function name. No database migration, `db push`, permission change, `config push`, cron/dispatcher deployment or secrets update is needed for this correction. Record the new function version, deployment timestamp and source SHA; inspect the deployed source/bundle for the helper import and `getIsoWeekYear(periodEnd).week`, with no remaining undefined `currentIso.week`. A new version number alone does not prove that the correct code was bundled. CLI behaviour and bundling flags: [official CLI reference](https://supabase.com/docs/reference/cli/supabase-functions-deploy); version-selection changes: [CLI v3 changelog](https://supabase.com/changelog/supabase-cli-v3).

**Controlled validation available now, without providers.** `npm run test:finalization` executes the actual handler with in-memory database/provider substitutes. For both AI-success and AI-fallback scenarios, the client has `auto_send_enabled: true` and the request explicitly supplies `bypass: false`. Assertions require HTTP 201, a persisted draft, `auto_sent: false`, the ISO week matching `period.end`, zero email-helper calls and zero network calls. This does not execute Deno or SQL and does not contact production. Resend code/settings remain untouched.

**Real smoke test still pending.** Use an explicitly approved isolated test project containing only synthetic data and no active scheduling that could process the fixture client. If none is available, stop at the local validation above. Generation creates or updates report/task/metric rows, so even `bypass: false` is not read-only. The example below deliberately asks for a separate test target rather than reusing the deployment target. A production invocation requires separate authorization and is outside this prepared test. Choose a dedicated existing test client owned by the signed-in test manager with a valid GitHub integration. Keep current Resend settings, do not invoke `approve-and-send` or the scheduler, and do not switch the client setting. The explicit JSON boolean `bypass: false` suppresses sending by this invocation; it cannot stop unrelated concurrent jobs, hence the isolated environment requirement.

```powershell
# TEST_MANAGER_ACCESS_TOKEN is a short-lived Supabase Auth user JWT supplied
# securely to this process, not a service-role key or a committed value.
$smokeProjectRef = Read-Host 'Separately approved isolated TEST project reference; never production'
if ([string]::IsNullOrWhiteSpace($smokeProjectRef)) { throw 'Explicit test target required' }
if ((Read-Host 'Confirm the project is isolated and test writes are authorized: type TEST ONLY') -cne 'TEST ONLY') {
  throw 'Test not authorized; no request sent'
}
if (-not $env:TEST_MANAGER_ACCESS_TOKEN) { throw 'Missing test-manager access token' }
$testClientId = Read-Host 'Dedicated test client UUID owned by this manager'
$headers = @{ Authorization = "Bearer $env:TEST_MANAGER_ACCESS_TOKEN" }
$payload = @{ client_id = $testClientId; period_days = 7; bypass = $false } | ConvertTo-Json
$response = Invoke-WebRequest -Method Post -UseBasicParsing `
  -Uri "https://$smokeProjectRef.supabase.co/functions/v1/generate-report" `
  -Headers $headers -ContentType 'application/json' -Body $payload
$result = $response.Content | ConvertFrom-Json
if ($response.StatusCode -ne 201 -or $result.success -ne $true -or
    $result.status -ne 'draft' -or $result.auto_sent -ne $false -or
    -not $result.report_id -or $result.sprint_metric.sprint -notmatch '^S\d+$') {
  throw 'Smoke test failed; inspect function logs and existing writes before any retry'
}
```

Inspect that report in the manager dashboard: three blocks, correct period and an ISO week matching `period.end` in UTC; verify the returned sprint counts against the selected test board. Check Supabase function logs for this invocation and confirm the previous undefined-variable error is absent, with no send attempted by this request. Record a sanitized result (date, source SHA, deployed version, HTTP status and observations), not JWTs, PATs, live portal URLs or client data. `generated_without_ai: true` validates the fallback path only, not live Gemini success. On failure, inspect existing report/metric writes before retrying; do not delete production rows or automatically roll back to the known-broken version 31.

This publication addresses the undefined week variable only. Sending concurrency, legacy tracking, dependency advisories and the unexecuted RLS suite remain open in [FINAL_AUDIT.md](FINAL_AUDIT.md). Neither this documentation update nor a successful smoke test resolves them.

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
