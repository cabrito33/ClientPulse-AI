# Client details — implemented UI

**Route:** `/dashboard/clients/[id]`\
**Source:** [src/app/dashboard/clients/[id]/page.tsx](../../../src/app/dashboard/clients/[id]/page.tsx)\
**Documented:** 2026-11-17

## Provenance

Documented from the existing Next.js/React/Tailwind implementation. No Google Stitch prototype or export exists. This is retrospective documentation, not an original design proposal. Shared tokens and capture limitations are in the [UI index](../README.md).

## Purpose and content

Manage a client and inspect reports, mappings, schedule and portal access.

## Layout and components

Breadcrumb, initials/avatar, name/status, portal/generation/renewal actions, report list, sprint chart, client configuration and mapping/auto-send controls.

## Navigation and data boundaries

Report rows open review. Generate creates/reuses a draft; renewal replaces the link after revoking prior active links. Back returns to /dashboard.

## Responsive behavior

Shared dashboard shell; details split into 1.2fr/0.8fr columns at lg and stack below; header actions wrap.

## Interaction and accessibility states

Generation, saving mappings, auto-send and renewal show their own loading/error states. Invalid client IDs use not-found. Schedule is displayed from database values; there is no general schedule-edit form in this screen. Visible focus styling is inherited from globals.css. Icons generally supplement text; keyboard and assistive-technology coverage is not an accessibility certification.

## Evidence

[Desktop screenshot](desktop.png) · [Mobile screenshot](mobile.png) · [Desktop DOM](desktop.html) · [Mobile DOM](mobile.html). PNGs capture this implementation running locally; protected views use clearly synthetic test fixtures. HTML is a runtime DOM snapshot with scripts removed and build-local stylesheet references, not a standalone deployed page or a Stitch export.
