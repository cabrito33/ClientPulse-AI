# Login — implemented UI

**Route:** `/login`\
**Source:** [src/app/login/page.tsx](../../../src/app/login/page.tsx)\
**Documented:** 2026-11-17

## Provenance

Documented from the existing Next.js/React/Tailwind implementation. No Google Stitch prototype or export exists. This is retrospective documentation, not an original design proposal. Shared tokens and capture limitations are in the [UI index](../README.md).

## Purpose and content

Authenticate agency managers with Supabase email/password.

## Layout and components

Centered Logo, heading, helper text and a white rounded form card with email and password labels, error panel and orange submit button.

## Navigation and data boundaries

Registration link opens /register; footer returns to /. After successful login only local /dashboard paths or /onboarding are accepted from next. The default destination is /dashboard.

## Responsive behavior

Single column with max-w-md at sm; outer padding adapts across sm/lg.

## Interaction and accessibility states

Submit disables while signing in and shows a spinner. Invalid credentials use Portuguese feedback; other provider failures are shown as errors. The protected-route middleware redirects signed-out users here. Visible focus styling is inherited from globals.css. Icons generally supplement text; keyboard and assistive-technology coverage is not an accessibility certification.

## Evidence

[Desktop screenshot](desktop.png) · [Mobile screenshot](mobile.png) · [Desktop DOM](desktop.html) · [Mobile DOM](mobile.html). PNGs capture this implementation running locally; protected views use clearly synthetic test fixtures. HTML is a runtime DOM snapshot with scripts removed and build-local stylesheet references, not a standalone deployed page or a Stitch export.
