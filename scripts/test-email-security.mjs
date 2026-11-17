#!/usr/bin/env node
/** Regression tests for the ACTUAL Resend renderer/dispatcher (no network). */
import assert from "node:assert/strict";
import test from "node:test";
import { buildReportEmailHtml, sendReportEmail } from "../supabase/functions/_shared/resend.ts";

const options = {
  toEmail: "customer@example.com",
  clientName: "Cliente <script>alert(1)</script>",
  companyName: "ACME <img src=x onerror=alert(1)>",
  periodStart: "2026-11-09",
  periodEnd: "2026-11-15",
  summaryDone: "<b>Work & progress</b>",
  summaryBlockers: "Nothing",
  summaryNextSteps: "Ship",
  portalToken: "bba12505-3dc4-4e31-9a64-0ad4e4f444e2",
  reportId: "bba12505-3dc4-4e31-9a64-0ad4e4f444e1",
  appUrl: "https://weekly-client-reports.vercel.app",
  language: "pt",
};

test("Email renderer escapes untrusted text and preserves canonical portal URL", () => {
  const html = buildReportEmailHtml(options);
  assert.doesNotMatch(html, /<script>|<img src=x onerror=/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;b&gt;Work &amp; progress&lt;\/b&gt;/);
  assert.match(html, /\/portal\/bba12505-3dc4-4e31-9a64-0ad4e4f444e2/);
});

test("Email without a real API key fails rather than reporting a fake delivery", async () => {
  const originalDeno = globalThis.Deno;
  try {
    globalThis.Deno = { env: { get: () => undefined } };
    await assert.rejects(
      () => sendReportEmail({ ...options, apiKey: "mock" }),
      /RESEND_API_KEY não configurada/,
    );
  } finally {
    globalThis.Deno = originalDeno;
  }
});

test("Sandbox 403 restrictions fail and never return mock delivery", async () => {
  const originalDeno = globalThis.Deno;
  const originalFetch = globalThis.fetch;
  try {
    globalThis.Deno = { env: { get: () => "onboarding@resend.dev" } };
    globalThis.fetch = async () => ({
      ok: false,
      status: 403,
      text: async () => "You can only send testing emails. Verify your domain.",
    });
    await assert.rejects(
      () => sendReportEmail({ ...options, apiKey: "test-key" }),
      /O Resend recusou o envio/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.Deno = originalDeno;
  }
});
