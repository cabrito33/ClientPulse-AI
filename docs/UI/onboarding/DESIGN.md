# Guided onboarding — implemented UI

**Route:** `/onboarding`\
**Source:** [src/app/onboarding/page.tsx](../../../src/app/onboarding/page.tsx)\
**Documented:** 2026-11-17

## Provenance

Documented from the existing Next.js/React/Tailwind implementation. No Google Stitch prototype or export exists. This is retrospective documentation, not an original design proposal. Shared tokens and capture limitations are in the [UI index](../README.md).

## Purpose and content

Connect GitHub, map statuses and configure the first client with PulseBot support.

## Layout and components

Four-step progress indicator; conversational PulseBot panel; optional voice input; selectable project buttons; three status selectors; client name/email/tone/language fields; completion summary.

## Navigation and data boundaries

Steps are connection/project, mapping, client profile, completion. Back/continue preserve local inputs. Completion links to the generated report or dashboard when generation did not finish.

## Responsive behavior

Single centered main column; mapping becomes three columns and profile fields two columns at sm. Chat and buttons wrap inside their existing cards.

## Interaction and accessibility states

PATs are masked in visible chat. Loading states cover conversation, project/column fetch and submission. A column-fetch failure displays an alert and blocks continuation. Missing blocked column is explicitly optional. Voice availability depends on browser capability/permission; transcription does not auto-send. Visible focus styling is inherited from globals.css. Icons generally supplement text; keyboard and assistive-technology coverage is not an accessibility certification.

## Evidence

[Desktop screenshot](desktop.png) · [Mobile screenshot](mobile.png) · [Desktop DOM](desktop.html) · [Mobile DOM](mobile.html). PNGs capture this implementation running locally; protected views use clearly synthetic test fixtures. HTML is a runtime DOM snapshot with scripts removed and build-local stylesheet references, not a standalone deployed page or a Stitch export.
