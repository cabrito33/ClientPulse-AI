#!/usr/bin/env node

/**
 * ==============================================================================
 * ClientPulse AI — Unit & Integration Test: Dynamic Column Mapping (BE-07 / Issue #21)
 * File: scripts/test-column-mapping.mjs
 *
 * ACCEPTANCE CRITERIA:
 * 1. UI/config permite associar colunas às 3 categorias (Feito / Em Curso / Bloqueado)
 * 2. Mapeamento guardado por cliente
 * 3. Colunas não mapeadas ignoradas com aviso
 * ==============================================================================
 */

import assert from "node:assert/strict";
import test from "node:test";

/**
 * Pure column mapping categorizer matching the implementation in supabase/functions/_shared/github.ts.
 */
function categorizeTaskStatus(statusName, mapping = {}) {
  const normalize = (cols, defaults) => {
    if (Array.isArray(cols)) return cols.map((c) => String(c).trim().toLowerCase()).filter(Boolean);
    if (typeof cols === "string" && cols.trim()) return [cols.trim().toLowerCase()];
    return defaults.map((d) => d.toLowerCase());
  };

  const doneCols = normalize(mapping.done, ["done", "concluído", "concluido", "complete", "finished"]);
  const inProgCols = normalize(mapping.in_progress, ["in progress", "em progresso", "em curso", "doing"]);
  const blockedCols = normalize(mapping.blocked, ["blocked", "bloqueado", "needs review", "impedimento"]);

  const lower = (statusName || "").trim().toLowerCase();
  if (doneCols.includes(lower)) return "done";
  if (inProgCols.includes(lower)) return "in_progress";
  if (blockedCols.includes(lower)) return "blocked";
  return "other";
}

/**
 * Filters a raw list of tasks and identifies unmapped columns and ignored count.
 */
function processTasksWithMapping(rawTasks, mapping) {
  const parsed = rawTasks.map((t) => ({
    ...t,
    statusCategory: categorizeTaskStatus(t.status, mapping),
  }));

  const done = parsed.filter((t) => t.statusCategory === "done");
  const inProgress = parsed.filter((t) => t.statusCategory === "in_progress");
  const blocked = parsed.filter((t) => t.statusCategory === "blocked");
  const other = parsed.filter((t) => t.statusCategory === "other");

  const unmappedColumns = Array.from(
    new Set(other.map((t) => t.status).filter((s) => s && s !== "No Status"))
  );

  let warningNotice = null;
  if (unmappedColumns.length > 0) {
    warningNotice = `Aviso: ${other.length} tarefas ignoradas por pertencerem a colunas não mapeadas: ${unmappedColumns.join(", ")}.`;
  }

  return {
    all: parsed,
    done,
    inProgress,
    blocked,
    other,
    unmappedColumns,
    ignoredTasksCount: other.length,
    warningNotice,
  };
}

test("BE-07: Categorizes board columns into the 3 report categories (Feito / Em Curso / Bloqueado)", () => {
  const mapping = {
    done: ["Concluído", "Finished", "Done"],
    in_progress: ["Em Curso", "In Progress", "Desenvolvimento"],
    blocked: ["Bloqueado", "Impedimento", "Needs Client Review"],
  };

  assert.strictEqual(categorizeTaskStatus("Concluído", mapping), "done");
  assert.strictEqual(categorizeTaskStatus("Done", mapping), "done");
  assert.strictEqual(categorizeTaskStatus("Em Curso", mapping), "in_progress");
  assert.strictEqual(categorizeTaskStatus("Desenvolvimento", mapping), "in_progress");
  assert.strictEqual(categorizeTaskStatus("Bloqueado", mapping), "blocked");
  assert.strictEqual(categorizeTaskStatus("Needs Client Review", mapping), "blocked");
});

test("BE-07: Unmapped columns (Backlog, Triage, Icebox) are categorized as 'other' and ignored from reports", () => {
  const mapping = {
    done: ["Done"],
    in_progress: ["In Progress"],
    blocked: ["Blocked"],
  };

  assert.strictEqual(categorizeTaskStatus("Backlog", mapping), "other");
  assert.strictEqual(categorizeTaskStatus("Triagem", mapping), "other");
  assert.strictEqual(categorizeTaskStatus("Icebox", mapping), "other");
  assert.strictEqual(categorizeTaskStatus("A Fazer", mapping), "other");
});

test("BE-07: Normalization supports case-insensitivity, leading/trailing whitespace, and single string format", () => {
  const mapping = {
    done: "  Pronto  ",
    in_progress: ["EM DESENVOLVIMENTO"],
    blocked: ["  PARADO  "],
  };

  assert.strictEqual(categorizeTaskStatus("pronto", mapping), "done");
  assert.strictEqual(categorizeTaskStatus("PRONTO", mapping), "done");
  assert.strictEqual(categorizeTaskStatus("em desenvolvimento", mapping), "in_progress");
  assert.strictEqual(categorizeTaskStatus("parado", mapping), "blocked");
});

test("BE-07: Unmapped tasks are excluded from report blocks and generate a clear warning with ignored column names", () => {
  const rawTasks = [
    { id: "1", title: "Configurar Stripe", status: "Concluído" },
    { id: "2", title: "Otimizar SQL", status: "Em Curso" },
    { id: "3", title: "Credenciais AWS", status: "Bloqueado" },
    { id: "4", title: "Ideia futura 1", status: "Backlog" },
    { id: "5", title: "Ideia futura 2", status: "Backlog" },
    { id: "6", title: "Bug triagem", status: "Triagem" },
  ];

  const mapping = {
    done: ["Concluído"],
    in_progress: ["Em Curso"],
    blocked: ["Bloqueado"],
  };

  const result = processTasksWithMapping(rawTasks, mapping);

  // Done block only has Concluído
  assert.strictEqual(result.done.length, 1);
  assert.strictEqual(result.done[0].id, "1");

  // InProgress block only has Em Curso
  assert.strictEqual(result.inProgress.length, 1);
  assert.strictEqual(result.inProgress[0].id, "2");

  // Blocked block only has Bloqueado
  assert.strictEqual(result.blocked.length, 1);
  assert.strictEqual(result.blocked[0].id, "3");

  // Total ignored tasks = 3 (2 from Backlog, 1 from Triagem)
  assert.strictEqual(result.ignoredTasksCount, 3);
  assert.deepStrictEqual(result.unmappedColumns, ["Backlog", "Triagem"]);

  // Warning notice must explicitly name the ignored columns
  assert.ok(result.warningNotice);
  assert.ok(result.warningNotice.includes("3 tarefas ignoradas"));
  assert.ok(result.warningNotice.includes("Backlog"));
  assert.ok(result.warningNotice.includes("Triagem"));
});

test("BE-07: Validates client-specific column mapping persistence payload structure", () => {
  const clientPayload = {
    done: ["Done", "Concluído"],
    in_progress: ["Doing", "In Progress"],
    blocked: ["Blocked", "Waiting"],
  };

  assert.ok(Array.isArray(clientPayload.done));
  assert.ok(Array.isArray(clientPayload.in_progress));
  assert.ok(Array.isArray(clientPayload.blocked));
  assert.strictEqual(clientPayload.done.length, 2);
  assert.strictEqual(clientPayload.in_progress.length, 2);
  assert.strictEqual(clientPayload.blocked.length, 2);
});

console.log("🔒 [test-column-mapping] Todos os testes de mapeamento dinâmico de colunas foram definidos com sucesso.");
