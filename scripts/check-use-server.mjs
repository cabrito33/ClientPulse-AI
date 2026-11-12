#!/usr/bin/env node

/**
 * ==============================================================================
 * ClientPulse AI — Validador de Ficheiros "use server"
 * Script: scripts/check-use-server.mjs
 *
 * OBJETIVO:
 * Garantir que nenhum ficheiro com a diretiva "use server" exporta constantes,
 * variáveis, classes, funções síncronas ou exportações por defeito.
 *
 * REGRA DO NEXT.JS / REACT SERVER ACTIONS:
 * Ficheiros com "use server" no topo são módulos de Server Actions.
 * O compilador do Next.js (SWC) rejeita o build com:
 * "Only async functions are allowed to be exported in a "use server" file"
 * se encontrar exportações que não sejam funções assíncronas (ou tipos/interfaces TS).
 *
 * PERMITIDO:
 * - export async function nomeDaFuncao(...)
 * - export type NomeDoTipo = ...
 * - export interface NomeDaInterface { ... }
 * - export type { ... }
 *
 * PROIBIDO:
 * - export const ... (ex: maxDuration, dynamic, constantes de config)
 * - export let ...
 * - export var ...
 * - export class ...
 * - export default ...
 * - export function ... (funções síncronas)
 * - export { ... } (re-exportação de valores)
 * ==============================================================================
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const srcDir = path.join(projectRoot, "src");

/**
 * Percorre recursivamente uma pasta procurando ficheiros com extensões específicas.
 */
function getFilesRecursively(dir, extensions) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getFilesRecursively(fullPath, extensions));
    } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Verifica se o ficheiro tem a diretiva "use server" ou 'use server'.
 */
function isUseServerFile(content) {
  // Remove comentários de bloco e de linha para verificar a primeira instrução
  const cleaned = content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .trim();

  return (
    cleaned.startsWith('"use server"') ||
    cleaned.startsWith("'use server'")
  );
}

/**
 * Analisa as linhas de um ficheiro "use server" à procura de exportações inválidas.
 */
function validateUseServerFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  if (!isUseServerFile(content)) {
    return [];
  }

  const lines = content.split(/\r?\n/);
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Ignora linhas vazias ou comentários
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
      continue;
    }

    // Procura por exportações
    if (trimmed.startsWith("export ")) {
      // Casos PERMITIDOS:
      // 1. export async function ...
      if (/^export\s+async\s+function\b/.test(trimmed)) {
        continue;
      }
      // 2. export type ...
      if (/^export\s+type\b/.test(trimmed)) {
        continue;
      }
      // 3. export interface ...
      if (/^export\s+interface\b/.test(trimmed)) {
        continue;
      }

      // Casos PROIBIDOS:
      // 1. export const ...
      // 2. export let ...
      // 3. export var ...
      // 4. export class ...
      // 5. export default ...
      // 6. export function (sem async) ...
      // 7. export { ... } (sem keyword type)
      let violationReason = "Exportação não assíncrona detetada";

      if (/^export\s+const\b/.test(trimmed)) {
        violationReason = "Proibido 'export const' (constantes de configuração devem estar em route.ts, page.tsx ou layout.tsx)";
      } else if (/^export\s+let\b/.test(trimmed)) {
        violationReason = "Proibido 'export let'";
      } else if (/^export\s+var\b/.test(trimmed)) {
        violationReason = "Proibido 'export var'";
      } else if (/^export\s+class\b/.test(trimmed)) {
        violationReason = "Proibido 'export class'";
      } else if (/^export\s+default\b/.test(trimmed)) {
        violationReason = "Proibido 'export default'";
      } else if (/^export\s+function\b/.test(trimmed)) {
        violationReason = "Proibido 'export function' síncrona (apenas 'export async function' é permitido)";
      } else if (/^export\s*\{/.test(trimmed)) {
        violationReason = "Proibido 'export { ... }' de valores";
      }

      violations.push({
        file: path.relative(projectRoot, filePath),
        line: i + 1,
        code: trimmed,
        reason: violationReason,
      });
    }
  }

  return violations;
}

// Execução principal
const files = getFilesRecursively(srcDir, [".ts", ".tsx"]);
const allViolations = [];

for (const file of files) {
  const violations = validateUseServerFile(file);
  allViolations.push(...violations);
}

if (allViolations.length > 0) {
  console.error("\n❌ [check-use-server] Foram encontradas violações de 'use server':\n");
  for (const v of allViolations) {
    console.error(`  • ${v.file}:${v.line}`);
    console.error(`    Código: ${v.code}`);
    console.error(`    Motivo: ${v.reason}\n`);
  }
  console.error(
    "Regra: Em ficheiros 'use server', apenas funções assíncronas ('export async function') e tipos TypeScript ('export type' / 'export interface') são permitidos pelo Next.js."
  );
  console.error(
    "Mova constantes de configuração (como maxDuration) para ficheiros de rota (route.ts), página (page.tsx) ou layout (layout.tsx).\n"
  );
  process.exit(1);
} else {
  console.log("✅ [check-use-server] Todos os ficheiros 'use server' são válidos (apenas funções assíncronas e tipos).");
  process.exit(0);
}
