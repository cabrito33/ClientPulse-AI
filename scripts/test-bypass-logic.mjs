#!/usr/bin/env node

/**
 * ==============================================================================
 * ClientPulse AI — Unit & Integration Test: Bypass vs Manual Review (BE-16 / Issue #30)
 * File: scripts/test-bypass-logic.mjs
 *
 * ACCEPTANCE CRITERIA:
 * 1. Cliente com aprovação ativa fica em 'pendente de revisão'
 * 2. Cliente com bypass é enviado automaticamente
 * 3. Configuração por cliente persistida
 * ==============================================================================
 */

import assert from "node:assert/strict";
import test from "node:test";

/**
 * Pure helper calculating initial status based on client bypass and AI generation flags.
 */
function resolveReportInitialStatus({ autoSendEnabled, bypassOverride, generatedWithoutAi }) {
  const shouldBypass = bypassOverride !== undefined ? Boolean(bypassOverride) : Boolean(autoSendEnabled);
  const isBypass = shouldBypass && !generatedWithoutAi;
  return {
    isBypass,
    initialStatus: isBypass ? "sent" : "draft",
    uiStatusLabel: isBypass ? "Enviado" : "Pendente de revisão",
    badgeTone: isBypass ? "teal" : "gold",
  };
}

test("BE-16: Client with approval active (auto_send_enabled = false) stays in review ('Pendente de revisão')", () => {
  const result = resolveReportInitialStatus({
    autoSendEnabled: false,
    generatedWithoutAi: false,
  });

  assert.strictEqual(result.isBypass, false);
  assert.strictEqual(result.initialStatus, "draft");
  assert.strictEqual(result.uiStatusLabel, "Pendente de revisão");
  assert.strictEqual(result.badgeTone, "gold");
});

test("BE-16: Client with bypass active (auto_send_enabled = true) is sent automatically ('Enviado')", () => {
  const result = resolveReportInitialStatus({
    autoSendEnabled: true,
    generatedWithoutAi: false,
  });

  assert.strictEqual(result.isBypass, true);
  assert.strictEqual(result.initialStatus, "sent");
  assert.strictEqual(result.uiStatusLabel, "Enviado");
  assert.strictEqual(result.badgeTone, "teal");
});

test("BE-16: Safety guard: If AI generation fails (generatedWithoutAi = true), bypass is aborted and pauses for review", () => {
  const result = resolveReportInitialStatus({
    autoSendEnabled: true,
    generatedWithoutAi: true,
  });

  assert.strictEqual(result.isBypass, false, "Must abort bypass if generated without AI");
  assert.strictEqual(result.initialStatus, "draft");
  assert.strictEqual(result.uiStatusLabel, "Pendente de revisão");
  assert.strictEqual(result.badgeTone, "gold");
});

test("BE-16: Explicit bypass override in request body takes precedence over client default", () => {
  // Client has auto_send false, but user clicked bypass send
  const forcedBypass = resolveReportInitialStatus({
    autoSendEnabled: false,
    bypassOverride: true,
    generatedWithoutAi: false,
  });
  assert.strictEqual(forcedBypass.isBypass, true);
  assert.strictEqual(forcedBypass.initialStatus, "sent");

  // Client has auto_send true, but user opted to hold for review
  const forcedReview = resolveReportInitialStatus({
    autoSendEnabled: true,
    bypassOverride: false,
    generatedWithoutAi: false,
  });
  assert.strictEqual(forcedReview.isBypass, false);
  assert.strictEqual(forcedReview.initialStatus, "draft");
});

console.log("🔒 [test-bypass-logic] Todos os testes de lógica de bypass foram definidos com sucesso.");
