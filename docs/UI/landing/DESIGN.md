# Landing page — implemented UI

**Route:** `/`\
**Source:** [src/app/page.tsx](../../../src/app/page.tsx)\
**Documented:** 2026-11-17

## Provenance

Documented from the existing Next.js/React/Tailwind implementation. No Google Stitch prototype or export exists. This is retrospective documentation, not an original design proposal. Shared tokens and capture limitations are in the [UI index](../README.md).

## Purpose and content

Public introduction and entry points to registration and the authenticated app.

## Layout and components

SiteHeader, ReportMockup, Badge, ButtonLink and SiteFooter. Ten sections: hero, problem, workflow, features, audience, comparison, pricing, FAQ, roadmap and final call to action. Orange calls to action sit beside a static sample report; sample/price claims are explicitly illustrative.

## Navigation and data boundaries

Header/footer anchors navigate within the page; account calls to action go to /register, /login, /dashboard or /onboarding. Protected destinations require login. FAQ uses native disclosure controls.

## Responsive behavior

The hero becomes two columns at lg. Feature cards progress from one to two/three columns. Header navigation switches to a menu below md; the comparison table has horizontal scrolling.

## Interaction and accessibility states

Sticky header gains a translucent background on scroll. Menu opens/closes and locks background scrolling. Hover/focus styles and reduced-motion support are implemented. Visible focus styling is inherited from globals.css. Icons generally supplement text; keyboard and assistive-technology coverage is not an accessibility certification.

## Evidence

[Desktop screenshot](desktop.png) · [Mobile screenshot](mobile.png) · [Desktop DOM](desktop.html) · [Mobile DOM](mobile.html). PNGs capture this implementation running locally; protected views use clearly synthetic test fixtures. HTML is a runtime DOM snapshot with scripts removed and build-local stylesheet references, not a standalone deployed page or a Stitch export.
