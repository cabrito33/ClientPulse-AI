# Final academic audit — ClientPulse AI

Review completed locally on 2026-11-18, continuing the 2026-11-17 audit. Branch: `codex/academic-finalization`; starting Main commit: `32c45da`. The user-requested checkpoint was pushed as `3f74eb7` before further corrections. Main, production data, Resend configuration, sprint assignments and Canva material were not changed.

This is an academic readiness review, not a production security certification. The app has substantial implementation and reproducible local evidence. Real provider delivery, SQL isolation and the PRD's user outcomes remain unproven by this audit.

**Historical pre-merge follow-up (2026-11-18; now resolved):** the owner reported hosted `generate-report` version 31 contained undefined `currentIso.week`. At the time the fix was in the PR but had not been deployed. [API.md](API.md#manual-publication-and-smoke-test-after-pr-60-is-merged) now documents the complete shared-module bundle, manual publication after merge and a draft-only smoke test using the actual `bypass: false` contract. Deployment and remote verification **were pending at the time of the original audit**. They were completed subsequently for v32 as recorded above. The original audit did not merge or deploy. All other residual risks below remain open.

## Post-merge verification (2026-11-18)

- PR [#60](https://github.com/cabrito33/ClientPulse-AI/pull/60) was merged into `Main` at commit `a081dd64a0034fc6460bd27c5d640dd7f372ea43`.
- GitHub Actions push CI for that commit completed successfully; the corresponding production Vercel deployment was `READY`.
- All seven hosted Supabase Edge Functions are `ACTIVE`, and **15 database migrations** match the versioned inventory. The production `generate-report` is **version 32, JWT verified**, with its entrypoint and seven shared modules inspected against the merged `Main`; the former undefined `currentIso.week` expression is not present.
- These are deployment and code-consistency checks. There is **no claim** that real GitHub/Gemini/Resend requests, production RLS isolation, delivery concurrency or two actual reporting cycles passed. Real-world metrics in [RESULTADOS.md](RESULTADOS.md) remain unmeasured.
- The old pre-merge paragraphs and initial test observations below are retained as historical records, not descriptions of the current deployment. Resend configuration was not changed by the corrective publication.

## Final verification after PR #61 merge (2026-11-18)

The documentation/metadata-only PR [#61](https://github.com/cabrito33/ClientPulse-AI/pull/61) was merged into `Main` at **`c5b6b1130514dd1c387e235980fb149431a03bd0`**. Its final GitHub Actions run (`44284400907`) passed before merge; the `Main` push CI run (`44290206990`) **passed**, and the production Vercel deployment was confirmed **READY** for the merged SHA. The live landing page showed the correct `og:url` (`https://weekly-client-reports.vercel.app`), and public/authentication-route HTTP checks found no application error responses. Invalid portal links correctly returned 404, and the tracking pixel returned an image.

**Independent test re-run:** `npm ci` and `npm run check` passed on the pre-#61 `Main`. In a disposable Linux environment the first browser attempt failed due to missing Chromium OS libraries; after installing those libraries, **all eight Playwright E2E tests passed** (four desktop and four mobile), using local provider/Auth/database substitutes. The final PR #61 document-link checker validated **260 local links and anchors**, superseding the historical audit result of 233. The separate `npm audit` still reported **17 advisories (11 high, 6 moderate, zero critical)**.

**Read-only production inspection:** all **seven** Supabase Edge Functions were `ACTIVE`; `generate-report` **v32** retained JWT verification and the correct ISO-week expression; **15** database migrations were present. Every one of the ten public tables inspected had RLS enabled, and five existing-data consistency checks for agency/client/report/token/task relationships returned **zero mismatches**. This does **not** establish that malicious cross-agency inserts/updates are impossible. The hourly `pg_cron` job was active, with 24 SQL executions marked `succeeded` during the inspected 24 hours; it does **not** prove external report generation or email receipt.

**Boundaries and preservation:** no authenticated production end-to-end user scenario, real GitHub/Gemini/Resend delivery, 15 adversarial SQL isolation tests or two measured weekly cycles were completed in this follow-up. The historical results and remaining risks below remain valid. **Resend and its configuration were not altered**. PR [#62](https://github.com/cabrito33/ClientPulse-AI/pull/62), proposing to retire legacy privileged email-tracking writes, remains **unmerged and undeployed** for a future phase. This is evidence of a reviewed **academic prototype**, not a security or production-readiness certification.

## Corrections and evidence

| Problem and impact | Local correction | Evidence |
| --- | --- | --- |
| Portal declared every client's data fictitious | Replaced unconditional disclaimer with a read-only/private-link notice; expiry text no longer asserts a fixed maximum | Desktop/mobile portal E2E and real screenshots using fixtures |
| Login forwarded arbitrary `next` to router | Allowlisted protected local destinations, rejecting executable/external/traversal inputs | Actual navigation helper regression; login E2E |
| Landing footer linked obsolete mock IDs/repository | Replaced with valid navigation and current repository | Anchor/link checks in browser |
| Onboarding fabricated fallback columns and could advance after failed reads/writes | Explicit column errors; disabled progression; optional blocked category; refreshed mapping on selection; stale request guard; required-input validation and persistence error handling | Actual action regressions and browser failure path |
| Client fields contained realistic-looking defaults | Empty initial values with existing placeholders and explicit labels | Onboarding E2E |
| Partial onboarding could imply report success | Completion distinguishes client configuration from generated draft | Source inspection; success-path browser test |
| Portal renewal ignored failed revocation | Stops before issuing replacement on revocation error | Actual API regression; non-atomic multi-write limit remains |
| Metrics reads and generation deleted apparently “future” sprint rows | Removed destructive cleanup; historical rows preserved | Actual API regression with S53 history |
| Generation referenced undefined `currentIso` | Derives ISO week from period end; shared helper uses UTC | Actual handler tests for AI success and fallback; year/timezone regression |
| Sidebar overview stayed active on child routes; duplicate React keys | Exact overview match and distinct navigation keys | Browser navigation and screenshot inspection |
| SQL test exceptions swallowed their own failure assertions | Catch only expected privilege errors; transactional fixtures with random IDs and rollback | Source review only; SQL execution unavailable |
| UI called elapsed review time “active” and implied measured PRD success | Corrected labels; identified <2 min as an additional diagnostic; privacy notices include client context/notes/chat | Source and screenshot review; no layout redesign |
| Documentation contradicted implementation | Filled confirmed team, aligned PT/EN goals/calendar, corrected API contracts, migration inventory, email/portal/privacy claims and real-test instructions | Relative-link checker; reviewed code references |

The API/privacy references were condensed around the current implementation. Original PRDs and historical research/audit records remain, with explicit alignment or supersession notes. No goals or acceptance gaps were silently deleted. A retrospective story map is labelled as a reconstruction, not a workshop record.

## Professor's requirements

Statuses use the requested categories. “Cumprido” refers to the stated artifact/implementation criterion, not untested production guarantees.

| Requirement | Status | Evidence and limit |
| --- | --- | --- |
| Functional SaaS with end-to-end experience | Parcialmente cumprido | Real Next app completes fixture-based browser flow; two real cycles/provider integration still lack evidence |
| Frontend, backend and database | Cumprido | Next/React, seven active hosted Edge Functions and 15 applied SQL migrations verified on 2026-11-18; real end-to-end integration not proven |
| Workflow automation | Parcialmente cumprido | Hourly `pg_cron` job active; 24 successful SQL job executions observed in one day. Provider delivery and concurrency safety remain unverified |
| AI directly in user functionality | Cumprido | Gemini report generation and PulseBot code; local handler/fallback tests do not establish AI accuracy |
| Landing, dashboard, registration and authentication | Cumprido | Implemented pages; registration confirmation, login and protected navigation exercised locally |
| Chatbot or voice bot for onboarding/support | Cumprido | PulseBot chat and optional Web Speech; no browser microphone/provider speech test |
| GitHub Issues and Projects for planning/tracking | Parcialmente cumprido | Project, issues, priorities/size/estimate fields and three iterations observed; stale statuses and missing ceremony evidence |
| PRD, technical and UI documentation under `/docs` | Cumprido | PT/EN PRDs, API/architecture/database/privacy, eight UI folders and audit/testing references |
| Preferably English Markdown documentation | Cumprido | English technical/UI/audit additions; original Portuguese PRD/research retained in Markdown |
| Google Stitch used in design process | Não cumprido | Team explicitly confirms it was not used; no fabricated exports |
| `/docs/UI/<page>/DESIGN.md`, PNG and HTML when available | Cumprido | Eight English DESIGN files; 16 real browser PNGs and 16 runtime DOM snapshots, clearly labelled fixtures |
| Five-week PRD calendar, three sprints and US01–US05 | Parcialmente cumprido | Both PRDs aligned; board iterations verified; mapping reconstructed, retrospective minutes not found |
| Real-use metrics and two cycles | Por validar | All user metrics remain unmeasured; closed DO-03 is not execution evidence |

## Test results

| Command/check | Observed result | Scope |
| --- | --- | --- |
| `npm ci` | Passed | Reproducible local dependency installation |
| `npm run lint` | Passed through `check` | Initial test-helper identifier failure corrected |
| `npx tsc --noEmit` | Passed through `check` | Next TypeScript scope, not all Deno functions |
| `npm test` | Passed: 89 tests | Existing scripts plus 11 actual-source finalization regressions |
| `npm run check` | Passed | Lint, types, server-action exports, Node tests, isolated production build |
| `npm run build` | Passed | Standalone production build |
| `npm run test:e2e` | 8/8 passed initially and in independent 2026-11-18 re-run | Desktop/mobile, local substitutes, no outbound email; initial independent attempt lacked Chromium OS libraries, fixed before rerun |
| `npm run test:docs` | Passed: 233 initially; **260** after final PR #61 updates | Local relative links/anchors and UI artifacts; no validation of external sites |
| SQL isolation script | Not executed | PostgreSQL/Docker unavailable; 15 definitions are not 15 passing results |
| Live GitHub/Gemini/Resend and two real report cycles | Not executed | `pg_cron` SQL job execution was verified separately; real providers, delivery and user outcomes were not |
| Dependency audit | 17 advisories reconfirmed: 6 moderate, 11 high, 0 critical | Upgrade review remains pending; no automatic major upgrade |

Detailed reproduction, failed attempts and evidence limitations: [TESTING.md](TESTING.md). UI origin: [UI/README.md](UI/README.md). Complete file inventory: [CHANGES.md](CHANGES.md).

## Important remaining issues

| Priority | Cause and impact | Proposed resolution / required validation |
| --- | --- | --- |
| High — tenant reference integrity | RLS validates an agency field while separate client/report foreign keys do not enforce a common tenant. Inconsistent references can contaminate metrics/portal data | Add local adversarial SQL tests, composite tenant foreign keys/ownership constraints, review existing rows; apply only through a separately reviewed migration |
| High — repeated/concurrent delivery | Check-then-write week lookup is not atomic; automatic send may precede persistence; manual approval lacks sent-state guard | Durable atomic delivery claim/unique period key and provider idempotency, transactional outbox; test concurrency and failure after delivery. Requires coordinated email/backend work outside this no-Resend-change review |
| High — legacy privileged tracking | `email-tracking` uses service role without equivalent handler authentication/signature validation; accepts arbitrary report IDs/timestamps, with portal lookup bypassing token lifecycle | Remove exposure or implement authenticated/signed/token-validated writes; test gateway settings and ownership in isolated deployment. Do not confuse it with the signed Next webhook |
| High — dependency advisories | `npm audit` reports vulnerable direct/transitive packages including Next/eslint-related dependency trees | Review advisory reachability, compatible patched versions and upgrade impact; run full regression before deployment |
| Medium — portal lifecycle/projection | Data RPC accepts NULL expiry, returns broader client metadata/metrics; renewal has multiple writes and email upsert can reactivate a token | Review null policy, sent-only metric scope, minimal fields and atomic renewal; migrate/test existing links without automatic production changes |
| Medium — tracking evidence | Next webhook/pixel use user-scoped DB access; anonymous RLS may reject updates; previews can mark opens | Dedicated minimal authenticated recording path with real SQL tests; distinguish transport acceptance, inbox receipt and human reading |
| Medium — sprint key | Snn lacks ISO year; different years can collide | Year-aware schema/key migration and historical-data review; deleted-history workaround has been removed |
| Medium — acceptance gaps | Default login does not auto-start onboarding, schedule UI incomplete, historical report text cannot be opened, subject/intro edits not persisted by approval contract | Focused product follow-ups and acceptance tests; criteria remain visible in both PRDs |
| Validation — actual outcomes | No measurements establish onboarding <5 min, efficacy >85%, preparation <10 min, accuracy >80%, ≥80% drafts under 3 edits or opens >70% | Run the two controlled cycles in [TESTE_REAL.md](TESTE_REAL.md) with permitted recipients and record sample/date/method in [RESULTADOS.md](RESULTADOS.md) |

These issues are not claims of observed production exploitation. No production permission/function change was applied during the final documentation follow-up. Optional later improvements include standalone offline HTML exports, broader browsers/accessibility testing, richer historical navigation and automated E2E in CI. The existing CI runs Node tests and build, not Playwright.

## Preservation and delivery

Existing architecture, visual design and features were retained. Changes correct observed behaviour and wording; no feature removal was intended or observed in tested paths. Resend configuration and provider code were not altered in this branch. No production database operation, deploy, destructive Git operation or force push was performed. Fixtures are explicitly synthetic; no measured outcomes, Stitch originals or sprint ceremonies were fabricated. Screenshots contain dummy identities only. Documentation identifies remaining limitations rather than claiming complete validation.

The original audit branch was merged through PR #60 on 2026-11-18. This updated document is a post-merge factual addendum and does not certify the remaining real-world acceptance criteria.
