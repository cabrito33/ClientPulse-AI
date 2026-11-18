# Implemented interface documentation

ClientPulse AI was developed directly in **Next.js, React and Tailwind CSS**. Google Stitch was **not used**, and there are no original Stitch PNG/HTML exports. The following documents describe the actual frontend retrospectively and preserve its existing visual design. They cannot prove compliance with the separate requirement to use Stitch during design.

## Interface index

| Interface | Route | Design |
| --- | --- | --- |
| Landing page | `/` | [DESIGN.md](landing/DESIGN.md) |
| Login | `/login` | [DESIGN.md](login/DESIGN.md) |
| Registration | `/register` | [DESIGN.md](register/DESIGN.md) |
| Guided onboarding | `/onboarding` | [DESIGN.md](onboarding/DESIGN.md) |
| Agency dashboard | `/dashboard` | [DESIGN.md](dashboard/DESIGN.md) |
| Report review | `/dashboard/reports/[id]` | [DESIGN.md](report-review/DESIGN.md) |
| Client portal | `/portal/[token]` | [DESIGN.md](client-portal/DESIGN.md) |
| Client details | `/dashboard/clients/[id]` | [DESIGN.md](client-detail/DESIGN.md) |

## Shared design language

Source: [globals.css](../../src/app/globals.css), [layout.tsx](../../src/app/layout.tsx), [base components](../../src/components/ui).

- Paper `#fbf9f5`, white surfaces, sand `#f2ede4`, ink `#12171b` and border `#e3ddd3`.
- Primary orange `#e8452a`; success teal `#0e5a52`; attention gold `#f2b33d`.
- Inter for interface text; Fraunces/serif for display headings. Rounded cards, pill buttons, fine borders and subtle shadows.
- Tailwind responsive breakpoints: sm 640px, md 768px, lg 1024px, xl 1280px. Visible focus outlines and prefers-reduced-motion are defined globally.

## Capture provenance and reproduction

The PNGs are actual Chromium screenshots of the running local production build of the frontend, captured with Playwright at 1440×1000 and 390×844 (full-page output may be taller). Capture date: 2026-11-18. Protected views use `example.test` addresses and dummy identifiers; landing illustrations and registration placeholders are existing presentation examples, not live client records; no production data, working credentials or email delivery is involved. The screenshots show the real implementation with simulated service responses, not live GitHub/Gemini/Supabase validation.

Run `npm ci`, `npx playwright install chromium`, then `CAPTURE_UI=1 npm run test:e2e` on POSIX or `$env:CAPTURE_UI='1'; npm.cmd run test:e2e` in PowerShell. Tests start two loopback servers and refuse to reuse an existing server. See [testing](../TESTING.md).

Each HTML file comes from a cloned runtime DOM with scripts and Next development overlays removed. CSS references point to the local Next build; the files are inspection snapshots, not self-contained offline replicas. Use PNGs to assess captured appearance. No original design files were replaced.

Only states actually captured have image evidence. Other loading, error, voice and interaction states described in DESIGN.md are source-inspected unless a test in [TESTING.md](../TESTING.md) explicitly covers them.
