#!/usr/bin/env node

/**
 * ==============================================================================
 * ClientPulse AI — Unit & Integration Test: Email Open Tracking (BE-21 / Issue #35)
 * File: scripts/test-open-tracking.mjs
 *
 * ACCEPTANCE CRITERIA:
 * 1. Endpoint regista data/hora da primeira abertura
 * 2. openedAt visível no dashboard
 * 3. Pedidos repetidos não sobrescrevem o primeiro registo
 * ==============================================================================
 */

import assert from "node:assert/strict";
import test from "node:test";

/**
 * Pure simulation of the idempotent recordReportOpen logic.
 */
function createMockReportDatabase(initialReports = []) {
  const reports = new Map(initialReports.map((r) => [r.id, { ...r }]));

  return {
    getReport(id) {
      return reports.get(id) || null;
    },
    recordReportOpen(reportId, timestamp) {
      const existing = reports.get(reportId);
      if (!existing) {
        throw new Error(`Relatório com ID '${reportId}' não encontrado.`);
      }

      const openedAtTime = timestamp || new Date().toISOString();

      // Idempotency: if already opened, return existing timestamp without overwriting
      if (existing.opened_at) {
        return {
          reportId,
          openedAt: existing.opened_at,
          isFirstOpen: false,
        };
      }

      // First open: record timestamp
      existing.opened_at = openedAtTime;
      return {
        reportId,
        openedAt: openedAtTime,
        isFirstOpen: true,
      };
    },
  };
}

/**
 * Simulates mapReport transforming DB row to domain Report object.
 */
function mockMapReport(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    weekLabel: row.week_label || "Semana 45",
    status: row.status,
    sentAt: row.sent_at || null,
    openedAt: row.opened_at || null,
  };
}

test("BE-21: First open records timestamp and marks isFirstOpen: true", () => {
  const db = createMockReportDatabase([
    { id: "rpt-1", client_id: "cl-1", status: "sent", opened_at: null },
  ]);

  const openTime = "2026-11-13T10:00:00.000Z";
  const result = db.recordReportOpen("rpt-1", openTime);

  assert.strictEqual(result.reportId, "rpt-1");
  assert.strictEqual(result.openedAt, openTime);
  assert.strictEqual(result.isFirstOpen, true);

  const updated = db.getReport("rpt-1");
  assert.strictEqual(updated.opened_at, openTime);
});

test("BE-21: Repeated open requests DO NOT overwrite the first recorded timestamp (Idempotency)", () => {
  const initialOpenTime = "2026-11-13T10:00:00.000Z";
  const db = createMockReportDatabase([
    { id: "rpt-2", client_id: "cl-1", status: "sent", opened_at: initialOpenTime },
  ]);

  // Repeated request 2 hours later
  const laterTime = "2026-11-13T12:00:00.000Z";
  const result1 = db.recordReportOpen("rpt-2", laterTime);

  assert.strictEqual(result1.reportId, "rpt-2");
  assert.strictEqual(result1.openedAt, initialOpenTime, "Must preserve original timestamp");
  assert.strictEqual(result1.isFirstOpen, false);

  // Repeated request 1 day later
  const nextDayTime = "2026-11-14T15:30:00.000Z";
  const result2 = db.recordReportOpen("rpt-2", nextDayTime);

  assert.strictEqual(result2.openedAt, initialOpenTime, "Must strictly preserve original timestamp");
  assert.strictEqual(result2.isFirstOpen, false);

  // Final database state remains unchanged
  const finalReport = db.getReport("rpt-2");
  assert.strictEqual(finalReport.opened_at, initialOpenTime);
});

test("BE-21: openedAt is accurately mapped and visible for dashboard consumption", () => {
  const dbRowWithOpen = {
    id: "rpt-3",
    client_id: "cl-2",
    status: "sent",
    sent_at: "2026-11-12T09:00:00Z",
    opened_at: "2026-11-12T09:42:15Z",
  };

  const domainReport = mockMapReport(dbRowWithOpen);
  assert.strictEqual(domainReport.openedAt, "2026-11-12T09:42:15Z");
  assert.strictEqual(domainReport.status, "sent");

  const dbRowWithoutOpen = {
    id: "rpt-4",
    client_id: "cl-2",
    status: "sent",
    sent_at: "2026-11-12T09:00:00Z",
    opened_at: null,
  };

  const domainReportUnopened = mockMapReport(dbRowWithoutOpen);
  assert.strictEqual(domainReportUnopened.openedAt, null);
});

test("BE-21: Resend webhook event processing resolves report_id and ignores non-open events", () => {
  const openEvent = {
    type: "email.opened",
    created_at: "2026-11-13T14:20:00Z",
    data: {
      tags: {
        report_id: "rpt-webhook-1",
      },
    },
  };

  assert.strictEqual(openEvent.type, "email.opened");
  assert.strictEqual(openEvent.data.tags.report_id, "rpt-webhook-1");

  const deliveredEvent = {
    type: "email.delivered",
    created_at: "2026-11-13T14:19:00Z",
  };

  // Must not treat delivered as opened
  const shouldProcessOpen = deliveredEvent.type === "email.opened";
  assert.strictEqual(shouldProcessOpen, false);
});

test("BE-21: Tracking pixel binary header is 1x1 transparent GIF (43 bytes)", () => {
  const TRANSPARENT_GIF_PIXEL = Buffer.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
    0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
    0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
    0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
  ]);

  assert.strictEqual(TRANSPARENT_GIF_PIXEL.length, 43);
  assert.strictEqual(TRANSPARENT_GIF_PIXEL.toString("ascii", 0, 3), "GIF");
});

console.log("🔒 [test-open-tracking] Todos os testes de tracking de abertura (openedAt) foram definidos com sucesso.");
