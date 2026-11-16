#!/usr/bin/env node

/**
 * ==============================================================================
 * ClientPulse AI — Unit Test: Report Live Editing & Space Preservation
 * File: scripts/test-report-editing.mjs
 *
 * ACCEPTANCE CRITERIA:
 * 1. Durante a edição no ecrã de revisão do relatório, espaços no final ou entre
 *    palavras NUNCA são eliminados prematuramente por .trim() ou .cleanList().
 * 2. Previne a concatenação acidental de texto durante digitação (ex.: "entregáveisdatuamae").
 * 3. serializeReportSections preserva espaços em itens ativos, mantendo a estrutura Markdown.
 * 4. Itens vazios ou constituídos apenas por espaços são omitidos do Markdown final.
 * 5. parseBodyToSections mantém suporte a cabeçalhos padrão e marcadores de lista.
 * ==============================================================================
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  REPORT_HEADINGS,
  serializeReportSections,
  parseBodyToSections,
  cleanBullet,
} from "../src/lib/report-utils.ts";

// ==============================================================================
// 1. PRESERVAÇÃO DE ESPAÇOS EM ITENS
// ==============================================================================

test("Preservação de espaços: texto com espaços múltiplos e entre palavras", () => {
  const sections = {
    done: ["entregáveis da tua equipa", "módulo de autenticação concluído"],
    blocks: ["aguarda aprovação do cliente"],
    next: ["deploy em staging"],
  };

  const md = serializeReportSections(sections);
  assert.match(md, /- entregáveis da tua equipa/);
  assert.match(md, /- módulo de autenticação concluído/);
  assert.match(md, /- aguarda aprovação do cliente/);
  assert.match(md, /- deploy em staging/);
});

test("Preservação de espaços: espaço final durante a digitação de uma nova palavra", () => {
  // Simula o utilizador a digitar: "entregáveis " (com espaço no fim, prestes a escrever "da")
  const sections = {
    done: ["entregáveis "],
    blocks: [],
    next: [],
  };

  const md = serializeReportSections(sections);
  // O espaço à direita NÃO deve ser removido do bullet
  assert.match(md, /- entregáveis \n/);
});

test("Simulação de digitação passo a passo: previne concatenação tipo 'entregáveisdatuamae'", () => {
  // Estado local do componente durante digitação
  let currentItem = "entregáveis";
  
  // Passo 1: utilizador prime a barra de espaços
  currentItem += " ";
  assert.equal(currentItem, "entregáveis ");
  
  // Serialização intermédia não altera a variável de estado
  let md = serializeReportSections({ done: [currentItem], blocks: [], next: [] });
  assert.ok(md.includes("- entregáveis "));

  // Passo 2: utilizador digita a próxima palavra "da"
  currentItem += "da";
  assert.equal(currentItem, "entregáveis da");

  // Passo 3: utilizador prime espaço
  currentItem += " ";
  assert.equal(currentItem, "entregáveis da ");

  // Passo 4: utilizador digita "tua"
  currentItem += "tua";
  assert.equal(currentItem, "entregáveis da tua");

  // Passo 5: utilizador prime espaço
  currentItem += " ";
  assert.equal(currentItem, "entregáveis da tua ");

  // Passo 6: utilizador digita "mãe"
  currentItem += "mãe";
  assert.equal(currentItem, "entregáveis da tua mãe");

  md = serializeReportSections({ done: [currentItem], blocks: [], next: [] });
  assert.ok(md.includes("- entregáveis da tua mãe"));
  assert.ok(!md.includes("entregáveisdatuamãe"), "Não deve concatenar palavras sem espaços");
});

test("Linhas vazias ou só com espaços: omitidas do markdown final mas não causam erro", () => {
  const sections = {
    done: ["Tarefa A", "", "   ", "Tarefa B"],
    blocks: ["  "],
    next: ["Próximo passo"],
  };

  const md = serializeReportSections(sections);
  assert.match(md, /- Tarefa A/);
  assert.match(md, /- Tarefa B/);
  assert.match(md, /- Próximo passo/);
  // Não deve conter marcadores sem texto
  assert.ok(!md.includes("- \n"));
  assert.ok(!md.includes("-   \n"));
});

test("Intro personalizada: preservada na serialização", () => {
  const intro = "Olá equipa, aqui está o resumo da semana.";
  const sections = {
    done: ["Entrega A"],
    blocks: [],
    next: [],
  };

  const md = serializeReportSections(sections, intro);
  assert.ok(md.startsWith(intro));
  assert.ok(md.includes(REPORT_HEADINGS.done));
});

// ==============================================================================
// 2. PARSE E HIGIENIZAÇÃO DE BULLETS
// ==============================================================================

test("cleanBullet: remove marcadores de lista variados", () => {
  assert.equal(cleanBullet("- Tarefa com hífen"), "Tarefa com hífen");
  assert.equal(cleanBullet("* Tarefa com asterisco"), "Tarefa com asterisco");
  assert.equal(cleanBullet("• Tarefa com bullet"), "Tarefa com bullet");
  assert.equal(cleanBullet("◦ Tarefa com círculo"), "Tarefa com círculo");
  assert.equal(cleanBullet("▪ Tarefa com quadrado"), "Tarefa com quadrado");
  assert.equal(cleanBullet("  -   Tarefa indentada"), "Tarefa indentada");
});

test("parseBodyToSections: faz round-trip limpo com serializeReportSections", () => {
  const initialSections = {
    done: ["Funcionalidade de login", "Otimização de base de dados"],
    blocks: ["Aguardar credenciais de API"],
    next: ["Lançamento em produção"],
  };

  const md = serializeReportSections(initialSections);
  const parsed = parseBodyToSections(md);

  assert.ok(parsed !== null);
  assert.deepEqual(parsed.done, initialSections.done);
  assert.deepEqual(parsed.blocks, initialSections.blocks);
  assert.deepEqual(parsed.next, initialSections.next);
});
