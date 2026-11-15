#!/usr/bin/env node

/**
 * ==============================================================================
 * ClientPulse AI — Speech Recognition & Transcript Processing Tests (FE-10)
 * File: scripts/test-voice-transcript.mjs
 *
 * ACCEPTANCE CRITERIA:
 * 1. Resultados acumulados (estilo Android): simula eventos Web Speech com texto
 *    acumulado e garante que o handler substitui sempre a partir de baseText,
 *    evitando o bug de concatenação repetitiva.
 * 2. Frases múltiplas: une múltiplos segmentos ou alternativas com um único espaço.
 * 3. Deduplicação de repetições consecutivas: remove repetições em sequência
 *    da mesma frase (ex.: "como funciona o client pulse ai como funciona..."),
 *    normalizando espaços e maiúsculas/minúsculas.
 * 4. Texto base pré-existente: preserva o texto que já se encontrava na caixa
 *    antes de iniciar o reconhecimento por voz, unindo-o de forma limpa.
 * ==============================================================================
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  processVoiceTranscript,
  extractVoiceTranscript,
  deduplicateConsecutivePhrases,
  combineVoiceTranscript,
  foldAccumulatedSegments,
} from "../src/lib/speech.ts";

// ==============================================================================
// 1. DEDUPLICAÇÃO DE REPETIÇÕES CONSECUTIVAS
// ==============================================================================

test("Deduplicação: bug real do Android - frase repetida 3 vezes em sequência", () => {
  const input =
    "como funciona o client pulse ai como funciona o client pulse ai como funciona o client pulse ai";
  const output = deduplicateConsecutivePhrases(input);
  assert.equal(output, "como funciona o client pulse ai");
});

test("Deduplicação: frase repetida 2 vezes em sequência", () => {
  const input = "como funciona o client pulse ai como funciona o client pulse ai";
  const output = deduplicateConsecutivePhrases(input);
  assert.equal(output, "como funciona o client pulse ai");
});

test("Deduplicação: frase repetida com diferenças de maiúsculas/minúsculas e pontuação", () => {
  const input = "Como funciona o Client Pulse AI? como funciona o client pulse ai";
  const output = deduplicateConsecutivePhrases(input);
  assert.equal(output, "Como funciona o Client Pulse AI?");
});

test("Deduplicação: frase repetida com ponto final em cada repetição", () => {
  const input = "relatório semanal pronto. relatório semanal pronto.";
  const output = deduplicateConsecutivePhrases(input);
  assert.equal(output, "relatório semanal pronto.");
});

test("Deduplicação: repetição consecutiva de sub-frase no interior de uma frase", () => {
  const input = "gostava de saber como funciona como funciona o sistema";
  const output = deduplicateConsecutivePhrases(input);
  assert.equal(output, "gostava de saber como funciona o sistema");
});

test("Deduplicação: repetição de palavra única repetida em sequência", () => {
  assert.equal(deduplicateConsecutivePhrases("ajuda ajuda"), "ajuda");
  assert.equal(deduplicateConsecutivePhrases("teste teste teste"), "teste");
});

test("Deduplicação: frase normal sem repetições permanece intacta", () => {
  const input = "como configurar o meu personal access token do github";
  const output = deduplicateConsecutivePhrases(input);
  assert.equal(output, "como configurar o meu personal access token do github");
});

// ==============================================================================
// 2. RESULTADOS ACUMULADOS (ESTILO ANDROID)
// ==============================================================================

test("Android acumulado: múltiplos eventos onresult com texto acumulado substituem sem duplicar", () => {
  // Simula o comportamento do Chrome para Android disparando 3 eventos onresult sucessivos
  const baseText = "";
  let currentBoxValue = baseText;

  // Evento 1: utilizador disse "como"
  const event1 = {
    results: [
      { 0: { transcript: "como" } },
    ],
  };
  currentBoxValue = processVoiceTranscript(baseText, event1.results);
  assert.equal(currentBoxValue, "como");

  // Evento 2: utilizador continuou e o Chrome enviou o texto acumulado "como funciona"
  const event2 = {
    results: [
      { 0: { transcript: "como funciona" } },
    ],
  };
  currentBoxValue = processVoiceTranscript(baseText, event2.results);
  assert.equal(currentBoxValue, "como funciona");

  // Evento 3: frase completa "como funciona o client pulse ai"
  const event3 = {
    results: [
      { 0: { transcript: "como funciona o client pulse ai" } },
    ],
  };
  currentBoxValue = processVoiceTranscript(baseText, event3.results);
  assert.equal(currentBoxValue, "como funciona o client pulse ai");
});

test("Android acumulado: segments na mesma lista onde cada um é um superconjunto acumulado do anterior", () => {
  const segments = [
    "como funciona",
    "como funciona o client pulse ai",
  ];
  const folded = foldAccumulatedSegments(segments);
  assert.deepEqual(folded, ["como funciona o client pulse ai"]);

  const result = extractVoiceTranscript(segments);
  assert.equal(result, "como funciona o client pulse ai");
});

test("Android acumulado: array com segmentos duplicados consecutivos", () => {
  const mockResults = [
    { 0: { transcript: "como funciona o client pulse ai" } },
    { 0: { transcript: "como funciona o client pulse ai" } },
  ];
  const result = extractVoiceTranscript(mockResults);
  assert.equal(result, "como funciona o client pulse ai");
});

// ==============================================================================
// 3. FRASES MÚLTIPLAS
// ==============================================================================

test("Frases múltiplas: diferentes segmentos são unidos por um único espaço", () => {
  const mockResults = [
    { 0: { transcript: "primeira frase" } },
    { 0: { transcript: "segunda frase" } },
    { 0: { transcript: "terceira frase" } },
  ];
  const result = extractVoiceTranscript(mockResults);
  assert.equal(result, "primeira frase segunda frase terceira frase");
});

test("Frases múltiplas: formato array de strings directas", () => {
  const segments = ["olá pulsebot", "ajuda-me a configurar", "o primeiro cliente"];
  const result = extractVoiceTranscript(segments);
  assert.equal(result, "olá pulsebot ajuda-me a configurar o primeiro cliente");
});

// ==============================================================================
// 4. TEXTO BASE PRÉ-EXISTENTE
// ==============================================================================

test("Texto base: quando não existe texto prévio, devolve apenas o texto ditado", () => {
  const result = processVoiceTranscript("", [{ 0: { transcript: "como funciona" } }]);
  assert.equal(result, "como funciona");
});

test("Texto base: junta texto existente sem espaço final com um espaço", () => {
  const result = processVoiceTranscript("Olá PulseBot,", [{ 0: { transcript: "como funciona o sistema" } }]);
  assert.equal(result, "Olá PulseBot, como funciona o sistema");
});

test("Texto base: texto existente já com espaço final não introduz espaço duplo", () => {
  const result = processVoiceTranscript("Pergunta: ", [{ 0: { transcript: "qual é o estado do projeto" } }]);
  assert.equal(result, "Pergunta: qual é o estado do projeto");
});

test("Texto base: se o ditado for vazio, mantém o texto base", () => {
  assert.equal(processVoiceTranscript("Texto guardado", []), "Texto guardado");
  assert.equal(processVoiceTranscript("Texto guardado", ""), "Texto guardado");
  assert.equal(processVoiceTranscript("Texto guardado", null), "Texto guardado");
});

test("Texto base: múltiplos eventos com texto base pré-existente preservam a base intacta", () => {
  const baseText = "PAT colado anteriormente: ";
  let box = baseText;

  // Evento 1
  box = processVoiceTranscript(baseText, [{ 0: { transcript: "não quero" } }]);
  assert.equal(box, "PAT colado anteriormente: não quero");

  // Evento 2 acumulado
  box = processVoiceTranscript(baseText, [{ 0: { transcript: "não quero ditar o token" } }]);
  assert.equal(box, "PAT colado anteriormente: não quero ditar o token");

  // Evento 3 com repetição do Android
  box = processVoiceTranscript(baseText, [
    { 0: { transcript: "não quero ditar o token não quero ditar o token" } },
  ]);
  assert.equal(box, "PAT colado anteriormente: não quero ditar o token");
});

// ==============================================================================
// 5. CASOS LIMITE E RESILIÊNCIA
// ==============================================================================

test("Casos limite: objetos SpeechRecognitionResultList simulados", () => {
  const listLike = {
    length: 2,
    0: { 0: { transcript: "Olá mundo" } },
    1: { 0: { transcript: "segundo bloco" } },
  };
  const result = extractVoiceTranscript(listLike);
  assert.equal(result, "Olá mundo segundo bloco");
});

test("Casos limite: entradas vazias, nulas ou espaços", () => {
  assert.equal(extractVoiceTranscript(null), "");
  assert.equal(extractVoiceTranscript(undefined), "");
  assert.equal(extractVoiceTranscript([]), "");
  assert.equal(extractVoiceTranscript("   "), "");
  assert.equal(combineVoiceTranscript("", ""), "");
  assert.equal(combineVoiceTranscript("  ", "  "), "");
});
