# Test evidence and reproduction

Audit environment: Windows, Node.js 24.20.0, npm 11.19.0, Chromium via Playwright 1.65.1. CI uses Node.js 22. The initial local audit (2026-11-17/18) recorded 89 Node tests, 8 browser tests and 233 valid local documentation links/anchors, along with lint, types and production builds. The later, separately verified results for the merged project are recorded below; the historical count of 233 is not the latest documentation count. No production credentials, provider sends or database changes were used.

## Post-merge deployment verification — 2026-11-18

On top of the historical local test observations below, the GitHub Actions `Main` push workflow for commit `a081dd64a0034fc6460bd27c5d640dd7f372ea43` passed, and the Vercel production build for that commit was `READY`. Hosted `generate-report` v32 was read back from Supabase: `verify_jwt` is true and the entrypoint plus seven shared modules match the merged source. The undefined `currentIso` reference is gone. This is **not** a live provider, SQL isolation, two-week use or actual e-mail-delivery test. No additional passing Node/Playwright test count is asserted here; the 89/8 counts below are from the recorded local audit.

## Final independent revalidation and release status — 2026-11-18

This follow-up checked the **actual** `Main` source (starting at `a081dd64`), reviewed the final PR #61 documentation revision (`bd61377`) and confirmed its **merged** production commit `c5b6b1130514dd1c387e235980fb149431a03bd0`. Findings were obtained in a separate disposable test environment and through read-only GitHub, Vercel and Supabase inspections:

| Verification | Observed result | Boundary |
| --- | --- | --- |
| `npm ci` and `npm run check` on the pre-#61 `Main` | Passed, exit code 0; lint, TypeScript, server-action exports, Node tests and Next.js production build | Does not run the Playwright or SQL suite |
| `npm run test:e2e` on the pre-#61 `Main` | **8/8 passed**: 4 desktop and 4 mobile browser tests using isolated fixture services | First attempt failed because the isolated Linux environment lacked Chromium system libraries; after `npx playwright install-deps chromium`, all eight passed. The first failure was environmental, not a proven app regression |
| `npm run test:docs` on final PR #61 revision | **260 local links and anchors passed** | Validates repository links/anchors, not external URLs or factual accuracy; supersedes the original 233 |
| GitHub Actions `Main` workflow for `c5b6b11` | **Passed** (run `44290206990`) | CI includes Node checks and build, **not** Playwright or the live RLS SQL suite |
| Vercel production after PR #61 merge | **READY** for `c5b6b11`; public home, login and registration responded HTTP 200; protected paths presented login; invalid portal tokens returned HTTP 404; the pixel returned a GIF | HTTP checks without a real signed-in user do not prove end-to-end workflow |
| Share metadata on the public site | `og:url` now points to `https://weekly-client-reports.vercel.app`, not the placeholder domain | No external social-preview crawler test |
| Hosted Supabase | Seven Edge Functions `ACTIVE`; `generate-report` **v32** with JWT verification and the corrected ISO-week expression; 15 migrations present | Source/read-back check, not a live report-generation request |
| Database read-only inspection | RLS enabled on all ten public tables; five tested current-data relationship mismatch counts were **zero** | Does not prove future composite-key integrity or cross-tenant RLS isolation; 15 adversarial SQL assertions remain **unexecuted** |
| Hourly scheduler | `dispatch-reports-hourly` active; 24 cron-job executions reported `succeeded` in the inspected 24-hour window | A successful SQL cron job does **not** prove delivery or provider success |
| `npm audit` | **17 advisories: 11 high, 6 moderate, 0 critical** | No dependency upgrade was applied |

The repository's signed-in flow with real Supabase Auth/GitHub, real Gemini results, real Resend delivery, two measured weekly cycles and actual client acceptance metrics **were not validated**. **Resend settings/code were not changed.** PR #62 is a separate draft security proposal and its legacy `email-tracking` changes are **not** part of `Main` or deployed through PR #61.

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

Historical publication preparation (2026-11-18): Supabase CLI 3.1.0 version/help was verified locally, before the later authorized v32 deployment. The two actual-handler regressions now explicitly test `bypass: false` against `auto_send_enabled: true`, with AI success/fallback, a draft write, correct ISO week, zero email-helper calls and a network-call guard. These remain part of the existing 11-test finalization suite. See [the controlled procedure](API.md#manual-publication-and-smoke-test-after-pr-60-is-merged). Deno/Postgres execution and real GitHub/Gemini smoke tests remain pending. The hosted v32 entrypoint and seven shared modules **were subsequently inspected and matched the merged source**, as detailed above; no production invocation is authorized by these instructions.

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
