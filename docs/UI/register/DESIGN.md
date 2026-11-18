# Registration — implemented UI

**Route:** `/register`\
**Source:** [src/app/register/page.tsx](../../../src/app/register/page.tsx)\
**Documented:** 2026-11-17

## Provenance

Documented from the existing Next.js/React/Tailwind implementation. No Google Stitch prototype or export exists. This is retrospective documentation, not an original design proposal. Shared tokens and capture limitations are in the [UI index](../README.md).

## Purpose and content

Create an agency user without assuming email confirmation is disabled.

## Layout and components

Centered Logo and form card: full name, optional agency/studio name, email and password. Labels, autocomplete and six-character password validation use the existing form design.

## Navigation and data boundaries

An immediate session routes to /onboarding. Without a session the public page remains visible and instructs the user to confirm email and then log in. Existing-account link opens /login.

## Responsive behavior

Same max-w-md responsive card as login; full-width primary button and stacked fields.

## Interaction and accessibility states

Loading, provider/network error and confirmation-required success panel (role=status). Actual confirmation email delivery and hosted Auth URL configuration require separate live validation. Visible focus styling is inherited from globals.css. Icons generally supplement text; keyboard and assistive-technology coverage is not an accessibility certification.

## Evidence

[Desktop screenshot](desktop.png) · [Mobile screenshot](mobile.png) · [Desktop DOM](desktop.html) · [Mobile DOM](mobile.html). PNGs capture this implementation running locally; protected views use clearly synthetic test fixtures. HTML is a runtime DOM snapshot with scripts removed and build-local stylesheet references, not a standalone deployed page or a Stitch export.
