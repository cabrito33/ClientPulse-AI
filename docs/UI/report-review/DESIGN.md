# Report review — implemented UI

**Route:** `/dashboard/reports/[id]`\
**Source:** [src/components/dashboard/report-review.tsx](../../../src/components/dashboard/report-review.tsx)\
**Documented:** 2026-11-17

## Provenance

Documented from the existing Next.js/React/Tailwind implementation. No Google Stitch prototype or export exists. This is retrospective documentation, not an original design proposal. Shared tokens and capture limitations are in the [UI index](../README.md).

## Purpose and content

Review the three generated blocks and explicitly approve sending.

## Layout and components

Breadcrumb, client/week/status header, primary approval action, privacy/fallback/unmapped-column notices, three editable block lists, full Markdown textarea, auto-send toggle and metric/context sidebar. Delivery result uses a modal.

## Navigation and data boundaries

Returns to dashboard/client; portal link opens published reports only. Approval invokes a Server Action and the authenticated Edge Function. Resend is available after failure. Edits to the three summary blocks are persisted by approval.

## Responsive behavior

Editor and 320px context column sit side by side at lg and stack below it. Header actions wrap; textareas grow with content.

## Interaction and accessibility states

Pending submission disables actions; error feedback and delivery modal expose failure or mock status. Empty reports require confirmation. Discard restores the input draft. Editing/approval UI tests use simulated email dispatch, not actual delivery. Subject/intro editing is not part of the persisted three-block API. Visible focus styling is inherited from globals.css. Icons generally supplement text; keyboard and assistive-technology coverage is not an accessibility certification.

## Evidence

[Desktop screenshot](desktop.png) · [Mobile screenshot](mobile.png) · [Desktop DOM](desktop.html) · [Mobile DOM](mobile.html). PNGs capture this implementation running locally; protected views use clearly synthetic test fixtures. HTML is a runtime DOM snapshot with scripts removed and build-local stylesheet references, not a standalone deployed page or a Stitch export.
