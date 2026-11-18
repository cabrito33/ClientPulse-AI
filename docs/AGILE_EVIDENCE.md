# Agile planning evidence

Read-only inspection on 2026-11-17 of the [repository](https://github.com/cabrito33/ClientPulse-AI), [Project 1](https://github.com/users/cabrito33/projects/1) and issue descriptions. No issues, sprint assignments, project fields or Canva documents were changed. The team confirmed Afonso Pedro and Miguel Lima (backend), Ricardo Santos and Manel Homem (frontend).

## Three iterations and five planned weeks

| GitHub iteration | Start | Duration | Inclusive end |
| --- | --- | --- | --- |
| Sprint 1 | 2026-10-27 | 8 days | 2026-11-03 |
| Sprint 2 | 2026-11-04 | 7 days | 2026-11-10 |
| Sprint 3 | 2026-11-11 | 7 days | 2026-11-17 |

These are the board's recorded iterations. The PRD's five weeks are planned work packages; they are not five GitHub sprints and do not prove five completed weeks of ceremonies or validation.

Project inspection found 49 items and fields including Status, Priority, Size, Estimate and Iteration. Status options are Backlog, To do, In progress, Review and Done; Priority uses High/Medium/Low, while issue labels use P0–P3; Size uses Quick/Medium/Long. Presence of an Estimate field is not evidence that every issue was estimated. Some Done stories have no iteration assignment.

**Snapshot distinction (2026-11-18):** the separately supplied `ClientPulse AI - Backlog.tsv` contains **44 rows**: Sprint 1 has 15/15 Done (47 estimated points), Sprint 2 has 10/10 Done (33), Sprint 3 has 11/12 Done (42), and seven rows have no iteration. The earlier count of 49 refers to the GitHub Projects inspection, not necessarily the same export or capture time. Do not present these counts as directly comparable or infer missing work from the difference. The TSV and the five-page sprint PDF are external delivery materials, not tracked source files here.

## Retrospective story map from the existing PRD

This table is an audit reconstruction for traceability, **not evidence that a story-mapping workshop occurred**.

| User activity | Story | Existing implementation | Remaining acceptance evidence |
| --- | --- | --- | --- |
| Connect project | US01 | PAT validation/storage, project selection, column mapping | Real private/org access and encrypted-storage checks |
| Learn/setup | US02 | PulseBot text/optional voice, guided steps | Automatic first-login entry, first-session efficacy >85%, total time <5 min |
| Configure recipient | US03 | Client name/email/tone/language and auto-send option | Complete schedule-editing UI and real configuration usability |
| Draft/review/send | US04 | Gemini three-block reports, fallback, editing and approval | Real AI accuracy, <3 edits criterion, delivery and concurrency protection |
| Read progress | US05 | Token portal, current sent report, historical list/chart | Real delivery/open evidence, full past-report navigation and SQL isolation |

## Discrepancies and missing evidence

- [DO-03 #37](https://github.com/cabrito33/ClientPulse-AI/issues/37) is closed, but its acceptance checkboxes remain unmarked and no comments/measurements establish two actual cycles. [RESULTADOS.md](RESULTADOS.md) remains unfilled for those outcomes.
- BE-04 #18 (audit logs), DO-04 #38 (tests) and DO-05 #39 (E2E) were Backlog despite related code or new local tests. DOC-02 #40 was Done although measured results remain absent. These are discrepancies to review, not reasons to silently rewrite the board.
- BE-17 #31 retry queue remains Backlog; a durable application retry queue is not implemented.
- Project readme still calls the product “Weekly Client Reports”, mentions additional integrations and contains a placeholder repository reference/course-name drift. This audit documents the discrepancy without editing the board.
- [ISSUES.md](ISSUES.md) is a historical planning draft. Its numbered entries are not verified current GitHub issue IDs and its five-week backend breakdown is not the three-iteration board.
- No original story-mapping workshop artifact, contemporaneous sprint retrospective minutes or Canva file is **stored in this repository**. A separate corrected five-page PDF (`ClientPulse_AI_Sprints_Simples_Corrigido.pdf`) was supplied for review: it summarizes the three sprints, a five-week plan and US01–US05. Its summary text must not be presented as independent minutes proving that ceremonies occurred. No ceremonies or decisions are invented; attach the approved PDF separately to the delivery if required.

Evidence was read using `gh project list`, `gh project field-list 1 --owner cabrito33 --format json`, `gh project item-list 1 --owner cabrito33 --limit 100 --format json` and the connected GitHub issue reader. No raw personal or credential-bearing payloads are committed.
