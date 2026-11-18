# Agency dashboard — implemented UI

**Route:** `/dashboard`\
**Source:** [src/app/dashboard/page.tsx](../../../src/app/dashboard/page.tsx)\
**Documented:** 2026-11-17

## Provenance

Documented from the existing Next.js/React/Tailwind implementation. No Google Stitch prototype or export exists. This is retrospective documentation, not an original design proposal. Shared tokens and capture limitations are in the [UI index](../README.md).

## Purpose and content

Inspect pending/sent reports, client status, sprint tasks and instrumented metrics.

## Layout and components

DashboardSidebar and DashboardTopbar surround greeting/actions, pending/failure alerts, four KPI cards, reports and clients lists, three sprint columns, chart and success metrics. Warm neutrals and semantic badges are shared with other screens.

## Navigation and data boundaries

Links open client detail and report review; onboarding is accessible from actions/navigation. Portal shortcut uses an actual client token. The overview sidebar item is active only on the overview route.

## Responsive behavior

248px sidebar is visible at lg; smaller viewports use sticky topbar and expandable navigation. Cards use sm/xl grids; content area is min-w-0 to avoid forcing page overflow.

## Interaction and accessibility states

Dashboard loading skeleton and retry error component exist. Empty lists invite setup. Report statuses distinguish draft/approval, sent and failed. The layout performs database reads outside the child error boundary: complete layout failure recovery remains a limitation. Visible focus styling is inherited from globals.css. Icons generally supplement text; keyboard and assistive-technology coverage is not an accessibility certification.

## Evidence

[Desktop screenshot](desktop.png) · [Mobile screenshot](mobile.png) · [Desktop DOM](desktop.html) · [Mobile DOM](mobile.html). PNGs capture this implementation running locally; protected views use clearly synthetic test fixtures. HTML is a runtime DOM snapshot with scripts removed and build-local stylesheet references, not a standalone deployed page or a Stitch export.
