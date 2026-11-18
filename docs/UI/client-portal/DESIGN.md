# Client portal — implemented UI

**Route:** `/portal/[token]`\
**Source:** [src/app/portal/[token]/page.tsx](../../../src/app/portal/[token]/page.tsx)\
**Documented:** 2026-11-17

## Provenance

Documented from the existing Next.js/React/Tailwind implementation. No Google Stitch prototype or export exists. This is retrospective documentation, not an original design proposal. Shared tokens and capture limitations are in the [UI index](../README.md).

## Purpose and content

Read reports already sent by the agency without signing in.

## Layout and components

Non-linked Logo, access badge, client/project banner, current report with task counts, three semantic blocks, sprint chart, historical report summaries and a read-only footer.

## Navigation and data boundaries

Valid bearer token is checked by get_portal_data_by_token. An authenticated preview offers a dashboard return link. History currently lists prior weeks and statuses; it does not open the full text of each previous report.

## Responsive behavior

Main content is max-w-5xl. Banner stacks below sm; count cards use two/four columns. Report sections remain single column; chart is responsive.

## Interaction and accessibility states

Valid token can show a sent report or an empty state. Expired/revoked links show an explanation and renewal instructions; unknown token reaches not-found. No unconditional claim that client records are fictional. Noindex, no-referrer and no-store are configured. Visible focus styling is inherited from globals.css. Icons generally supplement text; keyboard and assistive-technology coverage is not an accessibility certification.

## Evidence

[Desktop screenshot](desktop.png) · [Mobile screenshot](mobile.png) · [Desktop DOM](desktop.html) · [Mobile DOM](mobile.html). PNGs capture this implementation running locally; protected views use clearly synthetic test fixtures. HTML is a runtime DOM snapshot with scripts removed and build-local stylesheet references, not a standalone deployed page or a Stitch export.
