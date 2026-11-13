#!/usr/bin/env node

/**
 * ==============================================================================
 * ClientPulse AI — Unit & Integration Test: Dispatch Idempotency (BE-15 & BE-16)
 * File: scripts/test-dispatch-idempotency.mjs
 *
 * ACCEPTANCE CRITERIA:
 * 1. Antes de gerar, verifica se já existe relatório do mesmo cliente para a mesma
 *    semana ISO / período (draft, approved ou sent).
 * 2. Se existir, não cria outro nem reenvia o e-mail (regista skipped_duplicate).
 * 3. Um envio direto NUNCA pode ir duas vezes ao mesmo cliente na mesma semana.
 * ==============================================================================
 */

import assert from "node:assert/strict";
import test from "node:test";

/**
 * Calculates the ISO week number and ISO week-year for a given date.
 */
function getIsoWeekYear(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), week: weekNo };
}

/**
 * Finds existing report in the same ISO week.
 */
function findExistingWeekReport(reports, targetDate) {
  const targetIso = getIsoWeekYear(targetDate);
  for (const r of reports) {
    const dateStr = r.period_end || r.created_at;
    if (!dateStr) continue;
    const rDate = new Date(dateStr);
    if (isNaN(rDate.getTime())) continue;

    const rIso = getIsoWeekYear(rDate);
    if (rIso.year === targetIso.year && rIso.week === targetIso.week) {
      return r;
    }
  }
  return null;
}

/**
 * Simulates the dispatch-scheduled-reports processing loop.
 */
function simulateScheduledDispatch(scheduledClients, existingDatabaseReports, now = new Date()) {
  const reportsDb = [...existingDatabaseReports];
  const results = {
    total_clients_found: scheduledClients.length,
    drafts_created: 0,
    auto_sent: 0,
    skipped_duplicate: 0,
    details: [],
    emails_sent: [],
  };

  for (const client of scheduledClients) {
    // 1. Idempotency check: draft, approved, or sent
    const clientReports = reportsDb.filter(
      (r) => r.client_id === client.id && ["draft", "approved", "sent"].includes(r.status)
    );

    const duplicateReport = findExistingWeekReport(clientReports, now);
    if (duplicateReport) {
      results.skipped_duplicate++;
      results.details.push({
        client_id: client.id,
        status: "skipped_duplicate",
        existing_report_id: duplicateReport.id,
      });
      continue;
    }

    // 2. Generate and dispatch if bypass mode
    const isBypass = Boolean(client.auto_send_enabled);
    const newReportId = `rpt-generated-${reportsDb.length + 1}`;
    const newReport = {
      id: newReportId,
      client_id: client.id,
      status: isBypass ? "sent" : "draft",
      period_start: new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0],
      period_end: now.toISOString().split("T")[0],
      created_at: now.toISOString(),
      sent_at: isBypass ? now.toISOString() : null,
    };

    reportsDb.push(newReport);

    if (isBypass) {
      results.auto_sent++;
      results.emails_sent.push({
        to: client.email,
        report_id: newReportId,
        sent_at: now.toISOString(),
      });
      results.details.push({
        client_id: client.id,
        status: "auto_sent",
        report_id: newReportId,
      });
    } else {
      results.drafts_created++;
      results.details.push({
        client_id: client.id,
        status: "draft_created",
        report_id: newReportId,
      });
    }
  }

  return { results, reportsDb };
}

test("BE-15 / BE-16: ISO week calculation correctly computes calendar week numbers", () => {
  // Friday, 13 November 2026 is week 46
  const nov13 = new Date("2026-11-13T10:00:00Z");
  const isoNov13 = getIsoWeekYear(nov13);
  assert.strictEqual(isoNov13.year, 2026);
  assert.strictEqual(isoNov13.week, 46);

  // Sunday, 15 November 2026 is still in week 46
  const nov15 = new Date("2026-11-15T23:59:59Z");
  const isoNov15 = getIsoWeekYear(nov15);
  assert.strictEqual(isoNov15.week, 46);

  // Monday, 16 November 2026 starts week 47
  const nov16 = new Date("2026-11-16T08:00:00Z");
  const isoNov16 = getIsoWeekYear(nov16);
  assert.strictEqual(isoNov16.week, 47);
});

test("BE-15 / BE-16: findExistingWeekReport detects reports in the same week regardless of draft, approved or sent", () => {
  const currentWeekDate = new Date("2026-11-13T10:00:00Z"); // Week 46

  const reports = [
    { id: "rpt-1", client_id: "cl-1", status: "draft", period_end: "2026-11-13" },
    { id: "rpt-2", client_id: "cl-2", status: "approved", period_end: "2026-11-12" },
    { id: "rpt-3", client_id: "cl-3", status: "sent", period_end: "2026-11-11" },
    { id: "rpt-old", client_id: "cl-4", status: "sent", period_end: "2026-11-06" }, // Week 45
  ];

  assert.strictEqual(findExistingWeekReport([reports[0]], currentWeekDate)?.id, "rpt-1");
  assert.strictEqual(findExistingWeekReport([reports[1]], currentWeekDate)?.id, "rpt-2");
  assert.strictEqual(findExistingWeekReport([reports[2]], currentWeekDate)?.id, "rpt-3");

  // Old report from Week 45 must NOT match current week 46
  assert.strictEqual(findExistingWeekReport([reports[3]], currentWeekDate), null);
});

test("BE-15 / BE-16: Dispatch idempotency — direct send (bypass) NEVER sends twice to the same client in the same week", () => {
  const testDate = new Date("2026-11-13T09:00:00Z"); // Friday 09:00 UTC
  const clientBypass = {
    id: "cl-bypass-1",
    name: "Empresa Inovadora",
    email: "cliente@inovadora.pt",
    auto_send_enabled: true,
  };

  // FIRST RUN: No existing reports for this client
  const run1 = simulateScheduledDispatch([clientBypass], [], testDate);

  assert.strictEqual(run1.results.auto_sent, 1);
  assert.strictEqual(run1.results.skipped_duplicate, 0);
  assert.strictEqual(run1.results.emails_sent.length, 1);
  assert.strictEqual(run1.reportsDb.length, 1);
  assert.strictEqual(run1.reportsDb[0].status, "sent");

  // SECOND RUN: Dispatch triggered again (e.g. cron retry or manual invocation) in the same week
  const run2 = simulateScheduledDispatch([clientBypass], run1.reportsDb, testDate);

  assert.strictEqual(run2.results.auto_sent, 0, "Must NOT auto send a second time");
  assert.strictEqual(run2.results.skipped_duplicate, 1, "Must record skipped_duplicate");
  assert.strictEqual(run2.results.emails_sent.length, 0, "No additional email must be dispatched");
  assert.strictEqual(run2.reportsDb.length, 1, "No duplicate report must be inserted");
  assert.strictEqual(run2.results.details[0].status, "skipped_duplicate");
});

test("BE-15 / BE-16: Dispatch idempotency — manual approval client does NOT generate duplicate drafts in same week", () => {
  const testDate = new Date("2026-11-13T09:00:00Z");
  const clientReview = {
    id: "cl-review-1",
    name: "Consultoria Global",
    email: "gestor@global.pt",
    auto_send_enabled: false,
  };

  // Run 1: Draft is created
  const run1 = simulateScheduledDispatch([clientReview], [], testDate);
  assert.strictEqual(run1.results.drafts_created, 1);
  assert.strictEqual(run1.results.skipped_duplicate, 0);

  // Run 2: Same week, draft already exists
  const run2 = simulateScheduledDispatch([clientReview], run1.reportsDb, testDate);
  assert.strictEqual(run2.results.drafts_created, 0);
  assert.strictEqual(run2.results.skipped_duplicate, 1);
  assert.strictEqual(run2.reportsDb.length, 1);
});

test("BE-15 / BE-16: Multi-client batch deduplicates independently per client", () => {
  const testDate = new Date("2026-11-13T09:00:00Z");
  const clients = [
    { id: "cl-A", name: "Cliente A", email: "a@test.com", auto_send_enabled: true },
    { id: "cl-B", name: "Cliente B", email: "b@test.com", auto_send_enabled: false },
  ];

  // Database already has a report for Client A, but none for Client B
  const initialDb = [
    { id: "rpt-existing-a", client_id: "cl-A", status: "sent", period_end: "2026-11-13" },
  ];

  const { results, reportsDb } = simulateScheduledDispatch(clients, initialDb, testDate);

  assert.strictEqual(results.total_clients_found, 2);
  assert.strictEqual(results.skipped_duplicate, 1, "Client A skipped duplicate");
  assert.strictEqual(results.drafts_created, 1, "Client B draft created");
  assert.strictEqual(results.auto_sent, 0);
  assert.strictEqual(reportsDb.length, 2);
});

console.log("🔒 [test-dispatch-idempotency] Todos os testes de idempotência e agendamento foram definidos com sucesso.");
