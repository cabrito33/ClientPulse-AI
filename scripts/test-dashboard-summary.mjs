#!/usr/bin/env node

/**
 * ==============================================================================
 * ClientPulse AI — Unit Test: Dashboard Summary & Task Counts Projection
 * File: scripts/test-dashboard-summary.mjs
 *
 * ACCEPTANCE CRITERIA:
 * 1. extractTaskCounts funciona de forma pura com:
 *    - projeções PostgREST (campos em string tasks_completed e tasks_planned)
 *    - objetos numéricos directos
 *    - raw_github_data clássico com array tasks (statusCategory: 'done', state: 'CLOSED', status: 'Done')
 *    - arrays directos de tarefas
 *    - valores nulos, vazios ou inválidos (devolve 0, 0 com segurança)
 * 2. calculateDashboardSummary produz resultados 100% IDÊNTICOS aos calculados
 *    anteriormente com select("*"), garantindo consistência estrita dos números e textos do dashboard.
 * 3. Validação de métricas calculadas:
 *    - avgCompletionRate com proteção contra divisão por zero (Math.max(totalPlanned, 1))
 *    - timeSavedHours proporcional aos relatórios enviados (sent * 2.5)
 *    - contagem precisa de relatórios pendentes, enviados, falhados e clientes ativos.
 * ==============================================================================
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  extractTaskCounts,
  calculateDashboardSummary,
} from "../src/lib/report-utils.ts";

// ==============================================================================
// 1. TESTES DE extractTaskCounts
// ==============================================================================

test("extractTaskCounts: projeção PostgREST JSON em string (tasks_completed / tasks_planned)", () => {
  const projectedRow = {
    tasks_completed: "8",
    tasks_planned: "12",
  };
  const result = extractTaskCounts(projectedRow);
  assert.deepEqual(result, {
    tasksCompleted: 8,
    tasksPlanned: 12,
  });
});

test("extractTaskCounts: objeto numérico directo", () => {
  const directObj = {
    tasks_completed: 15,
    tasks_planned: 20,
  };
  const result = extractTaskCounts(directObj);
  assert.deepEqual(result, {
    tasksCompleted: 15,
    tasksPlanned: 20,
  });
});

test("extractTaskCounts: raw_github_data completo com array de tarefas", () => {
  const rawData = {
    tasks: [
      { id: "1", title: "Task 1", statusCategory: "done" },
      { id: "2", title: "Task 2", statusCategory: "in_progress" },
      { id: "3", title: "Task 3", statusCategory: "blocked" },
      { id: "4", title: "Task 4", statusCategory: "done" },
    ],
  };
  const result = extractTaskCounts(rawData);
  assert.deepEqual(result, {
    tasksCompleted: 2,
    tasksPlanned: 4,
  });
});

test("extractTaskCounts: tarefas com estado alternativo do GitHub (state: CLOSED ou status: Done)", () => {
  const rawData = {
    tasks: [
      { id: "1", state: "CLOSED" },
      { id: "2", state: "OPEN" },
      { id: "3", status: "Done" },
      { id: "4", status: "In Progress" },
    ],
  };
  const result = extractTaskCounts(rawData);
  assert.deepEqual(result, {
    tasksCompleted: 2,
    tasksPlanned: 4,
  });
});

test("extractTaskCounts: array directo de tarefas", () => {
  const rawArray = [
    { statusCategory: "done" },
    { statusCategory: "done" },
    { statusCategory: "blocked" },
  ];
  const result = extractTaskCounts(rawArray);
  assert.deepEqual(result, {
    tasksCompleted: 2,
    tasksPlanned: 3,
  });
});

test("extractTaskCounts: valores nulos, vazios ou inválidos devolvem 0, 0", () => {
  assert.deepEqual(extractTaskCounts(null), { tasksCompleted: 0, tasksPlanned: 0 });
  assert.deepEqual(extractTaskCounts(undefined), { tasksCompleted: 0, tasksPlanned: 0 });
  assert.deepEqual(extractTaskCounts({}), { tasksCompleted: 0, tasksPlanned: 0 });
  assert.deepEqual(extractTaskCounts("string-invalida"), { tasksCompleted: 0, tasksPlanned: 0 });
  assert.deepEqual(extractTaskCounts(123), { tasksCompleted: 0, tasksPlanned: 0 });
  assert.deepEqual(
    extractTaskCounts({ tasks_completed: "não-número", tasks_planned: null }),
    { tasksCompleted: 0, tasksPlanned: 0 }
  );
});

// ==============================================================================
// 2. PARIDADE DO DASHBOARD SUMMARY (ANTES vs. DEPOIS)
// ==============================================================================

test("Dashboard Summary: paridade absoluta entre select(*) e projeção PostgREST", () => {
  // Dados de teste realistas com 4 relatórios de diferentes estados
  const sampleReports = [
    {
      id: "rep-1",
      status: "draft",
      raw_github_data: {
        tasks_completed: 6,
        tasks_planned: 10,
        tasks: [
          { statusCategory: "done" },
          { statusCategory: "done" },
          { statusCategory: "done" },
          { statusCategory: "done" },
          { statusCategory: "done" },
          { statusCategory: "done" },
          { statusCategory: "in_progress" },
          { statusCategory: "in_progress" },
          { statusCategory: "blocked" },
          { statusCategory: "blocked" },
        ],
      },
    },
    {
      id: "rep-2",
      status: "sent",
      raw_github_data: {
        tasks_completed: 4,
        tasks_planned: 5,
        tasks: [
          { statusCategory: "done" },
          { statusCategory: "done" },
          { statusCategory: "done" },
          { statusCategory: "done" },
          { statusCategory: "in_progress" },
        ],
      },
    },
    {
      id: "rep-3",
      status: "approved",
      raw_github_data: {
        tasks_completed: 8,
        tasks_planned: 8,
        tasks: Array(8).fill({ statusCategory: "done" }),
      },
    },
    {
      id: "rep-4",
      status: "failed",
      raw_github_data: {
        tasks_completed: 2,
        tasks_planned: 6,
        tasks: [
          { statusCategory: "done" },
          { statusCategory: "done" },
          { statusCategory: "in_progress" },
          { statusCategory: "in_progress" },
          { statusCategory: "blocked" },
          { statusCategory: "blocked" },
        ],
      },
    },
  ];

  const pendingCount = 2; // rep-1 (draft) + rep-3 (approved)
  const sentCount = 1;    // rep-2 (sent)
  const activeClientsCount = 3;

  // 1. Método clássico (select *): itera sobre raw_github_data completo
  let oldTotalDone = 0;
  let oldTotalPlanned = 0;
  let oldFailed = 0;
  for (const r of sampleReports) {
    const counts = extractTaskCounts(r.raw_github_data);
    oldTotalDone += counts.tasksCompleted;
    oldTotalPlanned += counts.tasksPlanned;
    if (r.status === "failed") {
      oldFailed++;
    }
  }
  const oldSummary = {
    pending: pendingCount,
    sentThisMonth: sentCount,
    activeClients: activeClientsCount,
    failed: oldFailed,
    avgCompletionRate: Math.round((oldTotalDone / Math.max(oldTotalPlanned, 1)) * 100),
    timeSavedHours: Math.round(sentCount * 2.5),
  };

  // 2. Método novo otimizado (projeção PostgREST com operadores ->>)
  const projectedRows = sampleReports.map((r) => ({
    status: r.status,
    tasks_completed: String(r.raw_github_data.tasks_completed),
    tasks_planned: String(r.raw_github_data.tasks_planned),
  }));

  const newSummary = calculateDashboardSummary({
    pendingCount,
    sentCount,
    activeClientsCount,
    reportRows: projectedRows,
  });

  // Ambas as métricas têm de ser 100% idênticas
  assert.deepEqual(newSummary, oldSummary);
  assert.equal(newSummary.pending, 2);
  assert.equal(newSummary.sentThisMonth, 1);
  assert.equal(newSummary.activeClients, 3);
  assert.equal(newSummary.failed, 1);
  // (6 + 4 + 8 + 2) / (10 + 5 + 8 + 6) = 20 / 29 = 68.96% -> 69%
  assert.equal(newSummary.avgCompletionRate, 69);
  // 1 * 2.5 = 2.5 -> Math.round -> 3
  assert.equal(newSummary.timeSavedHours, 3);
});

// ==============================================================================
// 3. CASOS LIMITE DE RESILIÊNCIA
// ==============================================================================

test("Dashboard Summary: lista vazia de relatórios não causa divisão por zero", () => {
  const summary = calculateDashboardSummary({
    pendingCount: 0,
    sentCount: 0,
    activeClientsCount: 0,
    reportRows: [],
  });

  assert.equal(summary.pending, 0);
  assert.equal(summary.sentThisMonth, 0);
  assert.equal(summary.activeClients, 0);
  assert.equal(summary.failed, 0);
  assert.equal(summary.avgCompletionRate, 0);
  assert.equal(summary.timeSavedHours, 0);
});

test("Dashboard Summary: relatórios com 0 tarefas planeadas não causam erro de cálculo", () => {
  const rows = [
    { status: "draft", tasks_completed: "0", tasks_planned: "0" },
    { status: "sent", tasks_completed: "0", tasks_planned: "0" },
  ];

  const summary = calculateDashboardSummary({
    pendingCount: 1,
    sentCount: 1,
    activeClientsCount: 1,
    reportRows: rows,
  });

  assert.equal(summary.avgCompletionRate, 0);
  assert.equal(summary.timeSavedHours, 3); // 1 * 2.5 = 3
});
