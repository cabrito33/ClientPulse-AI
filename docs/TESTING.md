# Test evidence and reproduction

Audit environment: Windows, Node.js 24.20.0, npm 11.19.0, Chromium via Playwright 1.65.1. CI uses Node.js 22. Local results were collected on 2026-11-17/18: 89 Node tests, 8 browser tests and 233 local documentation links/anchors passed, along with lint, types and both production build commands. No production credentials, provider sends or database changes were used.

## Commands and scope

```bash
npm ci
npm run lint
npx tsc --noEmit
npm test
npm run build
npm run check
npx playwright install chromium
npm run test:e2e
npm run test:docs
```

On Windows PowerShell use `npm.cmd`/`npx.cmd` if script execution policy blocks the `.ps1` wrappers. `check` includes lint, TypeScript, server-action export checks, all Node test scripts and an isolated production build in `.next-check`. It includes the documentation link check through `npm test`, but does not run Playwright or SQL. Next's TypeScript check excludes Supabase Deno functions; a passing build alone did not catch the undefined `currentIso` variable corrected in this audit.

## What is actually exercised

Publication preparation follow-up (2026-11-18): actual cached Supabase CLI 3.1.0 version/help was verified, without hosted commands. The two actual-handler regressions now explicitly test `bypass: false` against `auto_send_enabled: true`, with AI success/fallback, a draft write, correct ISO week, zero email-helper calls and a network-call guard. These remain part of the existing 11-test finalization suite. See [the controlled procedure](API.md#manual-publication-and-smoke-test-after-pr-60-is-merged). Deno/Postgres execution, deployed-bundle inspection and real GitHub/Gemini smoke tests remain pending; no production invocation is authorized by these instructions.

| Evidence | Scope | Does not establish |
| --- | --- | --- |
| Existing Node scripts | Security allowlist, bypass/mapping/tracking/dispatch/email logic, PAT access, rate limits, voice text, summaries, editing and email escaping/failure | Several scripts simulate or duplicate orchestration; they are not live integration tests |
| `test:finalization` (11 tests) | Actual navigation/UTC helper; actual onboarding actions and API functions with dependency substitutes; actual generate-report handler with AI success/failure substitutes | Deno deployment, real Postgres/RLS, actual GitHub/Gemini output or email delivery |
| `test:dispatch` | Actual ISO-week/dedup helper, plus simulated dispatcher scenarios | Atomicity, concurrent jobs or exactly-once email delivery |
| Playwright (8 tests) | Real production-built Next app, middleware/server actions, browser interaction on desktop 1440×1000 and mobile 390×844 | Real Supabase Auth, SQL constraints, AI quality, providers or real-use PRD goals |
| SQL isolation script (15 checks) | Test definitions improved to fail correctly and roll back fixture data | **Not executed**: no local PostgreSQL/Docker runtime; no isolation pass count claimed |
| Documentation checker | Existing relative files, UI PNG/HTML and Markdown heading links | External website availability or factual accuracy of source claims |

Playwright covers landing anchors; registration awaiting email confirmation; wrong-password and successful login; protected redirects; bot-assisted onboarding; project selection, optional blocked mapping and client creation; draft review/approval; dashboard/mobile menu; client detail; public portal; column-fetch failure; invalid/expired/revoked links. Fixtures explicitly substitute Auth, PostgREST and Edge endpoints. Approval only changes in-memory test state and never calls Resend.

## Isolation and screenshots

`playwright.config.ts` starts a loopback fixture server on 54329 and builds/serves Next on 3100 with dummy public credentials. Existing servers are not reused. Browser traffic to non-loopback hosts is blocked. The fixture makes no outbound provider requests; application server calls point at it. Build-time font downloads may use the network.

Capture with `CAPTURE_UI=1 npm run test:e2e` on POSIX or `$env:CAPTURE_UI='1'; npm.cmd run test:e2e` in PowerShell. Eight interface folders each contain desktop/mobile PNG and runtime HTML. Chart capture waits for Recharts' JavaScript animation. These are synthetic-service screenshots of real UI, not Stitch exports. See [UI provenance](UI/README.md).

## Failures found during validation

- Initial lint caught a forbidden local identifier `module` in the test transpiler; renamed to `loaded`.
- Early browser runs exposed fixture CORS hostname mismatch, a route-announcer locator ambiguity, auth-clear/RSC navigation races and cold dev compilation timeouts. Fixtures now use a consistent frontend origin, precise alert matching and leave the protected page before clearing cookies.
- A Chromium full-page PNG capture transiently failed; capture alone now retries for up to five seconds. Test assertions are not retried or weakened.
- Development mode also emitted intermittent manifest JSON errors. E2E now builds and starts production mode; the production-mode run passed all eight tests.
- Runtime handler regression caught undefined ISO-week state in `generate-report`; now derives the week from `periodEnd`. Fallback is tested as a successful draft, not an email send.
- SQL checks previously swallowed their own failure assertions through `WHEN OTHERS`. Expected permission failures are now caught narrowly; the script remains unexecuted locally.

Non-blocking warnings observed: Node module-type inference, Playwright color environment and webpack cache serialization. Dependency audit reported 17 advisories (6 moderate, 11 high); no automatic breaking upgrade was applied. Security/production validation still required is listed in [FINAL_AUDIT.md](FINAL_AUDIT.md).
