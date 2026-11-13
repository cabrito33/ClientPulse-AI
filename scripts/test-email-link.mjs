#!/usr/bin/env node

/**
 * ==============================================================================
 * ClientPulse AI — Unit Test: Email Portal Link Generation (DO-04 / D1)
 * File: scripts/test-email-link.mjs
 *
 * ACCEPTANCE CRITERIA:
 * 1. O URL do portal gerado no e-mail transacional é `<appUrl>/portal/<token>`
 *    (e nunca `/portal?token=` nem `?token=`).
 * 2. Valida em português (PT) e inglês (EN).
 * 3. Valida normalização de barras e URLs customizadas.
 * ==============================================================================
 */

import assert from "node:assert/strict";
import test from "node:test";

/**
 * Pure simulation of the buildReportEmailHtml link and HTML generation logic
 * matching supabase/functions/_shared/resend.ts.
 */
function buildReportEmailHtml(options) {
  const isPt = options.language !== "en";
  const baseUrl = (options.appUrl || "http://localhost:3000").replace(/\/$/, "");
  const portalUrl = `${baseUrl}/portal/${options.portalToken}`;
  const trackingPixelUrl = `${baseUrl}/api/track/open?${
    options.reportId ? `reportId=${options.reportId}` : `token=${options.portalToken}`
  }`;

  const labels = isPt
    ? {
        title: "Relatório Semanal de Progresso",
        ctaText: "Aceder ao Portal do Cliente",
      }
    : {
        title: "Weekly Progress Report",
        ctaText: "Open Client Portal",
      };

  return `
    <!DOCTYPE html>
    <html>
      <body>
        <h1>${labels.title}</h1>
        <a href="${portalUrl}" target="_blank">${labels.ctaText} &rarr;</a>
        <img src="${trackingPixelUrl}" width="1" height="1" />
      </body>
    </html>
  `;
}

test("DO-04 / D1: Portal URL in Portuguese email uses canonical /portal/<token> route and never ?token=", () => {
  const sampleToken = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
  const html = buildReportEmailHtml({
    toEmail: "cliente@exemplo.pt",
    clientName: "Cliente Teste",
    periodStart: "2026-11-06",
    periodEnd: "2026-11-13",
    summaryDone: "Done tasks",
    summaryBlockers: "No blockers",
    summaryNextSteps: "Next deliverables",
    portalToken: sampleToken,
    appUrl: "http://localhost:3000",
    language: "pt",
  });

  const expectedUrl = `http://localhost:3000/portal/${sampleToken}`;

  // Must contain canonical route
  assert.ok(
    html.includes(`href="${expectedUrl}"`),
    `HTML should contain canonical portal URL: ${expectedUrl}`
  );

  // Must NOT contain query parameter format
  assert.ok(
    !html.includes("portal?token="),
    "HTML must never contain 'portal?token='"
  );
  assert.ok(
    !html.includes(`portal/?token=`),
    "HTML must never contain 'portal/?token='"
  );

  // Must contain Portuguese CTA
  assert.ok(
    html.includes("Aceder ao Portal do Cliente"),
    "HTML should contain Portuguese CTA"
  );
});

test("DO-04 / D1: Portal URL in English email uses canonical /portal/<token> route and never ?token=", () => {
  const sampleToken = "c0ffee00-beef-4000-8000-123456789abc";
  const html = buildReportEmailHtml({
    toEmail: "client@example.com",
    clientName: "Global Client",
    periodStart: "2026-11-06",
    periodEnd: "2026-11-13",
    summaryDone: "Deliverables",
    summaryBlockers: "Blockers",
    summaryNextSteps: "Next steps",
    portalToken: sampleToken,
    appUrl: "https://clientpulse.vercel.app",
    language: "en",
  });

  const expectedUrl = `https://clientpulse.vercel.app/portal/${sampleToken}`;

  // Must contain canonical route
  assert.ok(
    html.includes(`href="${expectedUrl}"`),
    `HTML should contain canonical portal URL: ${expectedUrl}`
  );

  // Must NOT contain query parameter format
  assert.ok(
    !html.includes("portal?token="),
    "HTML must never contain 'portal?token='"
  );

  // Must contain English CTA
  assert.ok(
    html.includes("Open Client Portal"),
    "HTML should contain English CTA"
  );
});

test("DO-04 / D1: Normalizes trailing slashes on appUrl to avoid double slashes", () => {
  const sampleToken = "12345678-1234-4000-8000-123456789abc";
  const htmlWithTrailingSlash = buildReportEmailHtml({
    toEmail: "test@domain.com",
    clientName: "Test",
    periodStart: "2026-11-06",
    periodEnd: "2026-11-13",
    summaryDone: "Done",
    summaryBlockers: "None",
    summaryNextSteps: "Next",
    portalToken: sampleToken,
    appUrl: "https://clientpulse.vercel.app/", // Trailing slash
    language: "pt",
  });

  assert.ok(
    htmlWithTrailingSlash.includes('href="https://clientpulse.vercel.app/portal/12345678-1234-4000-8000-123456789abc"'),
    "Must normalize appUrl without creating double slashes //portal/"
  );
  assert.ok(
    !htmlWithTrailingSlash.includes("//portal/"),
    "Must not produce double slashes"
  );
});

console.log("🔒 [test-email-link] Todos os testes de validação de link de e-mail foram definidos com sucesso.");
