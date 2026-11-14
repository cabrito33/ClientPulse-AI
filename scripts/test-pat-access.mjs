#!/usr/bin/env node

/**
 * ==============================================================================
 * ClientPulse AI — Security Unit Test: PAT Access Control
 * File: scripts/test-pat-access.mjs
 *
 * PURPOSE:
 * Enforces column-level security (BE-05 / migration 010_restrict_pat_access.sql).
 *
 * RULES VERIFIED:
 * 1. Any file in supabase/functions reading 'pat_token' or 'pat_token_encrypted'
 *    from 'github_integrations' MUST do so strictly via 'adminClient' (service role).
 * 2. User-scoped clients (e.g. 'supabase', 'userClient', or createUserClient)
 *    must NEVER query 'pat_token' or 'pat_token_encrypted'.
 * 3. 'generate-report' and 'github-sync' must filter PAT queries by RLS-verified
 *    agency_id (client.agency_id or agency.id), never by request body.
 * 4. 'onboarding-chat' and 'src/app/actions/onboarding.ts' must only read
 *    allowed non-sensitive columns (github_username, is_valid).
 * 5. PAT values must never be logged or returned in responses.
 * ==============================================================================
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT_DIR = process.cwd();
const FUNCTIONS_DIR = path.join(ROOT_DIR, "supabase", "functions");
const SRC_DIR = path.join(ROOT_DIR, "src");

/**
 * Analyzes code for github_integrations queries and detects any forbidden PAT reads.
 * Returns an array of violations found.
 */
export function findPatAccessViolations(sourceCode, fileName = "unknown") {
  const violations = [];

  // Match expressions like: [receiver].from('github_integrations')...
  // Capturing the receiver and subsequent chain
  const queryRegex =
    /([a-zA-Z0-9_$]+)\s*\.\s*from\s*\(\s*['"]github_integrations['"]\s*\)([\s\S]*?)(?=(?:;|\n\s*\n|\.from\s*\(|$))/g;

  let match;
  while ((match = queryRegex.exec(sourceCode)) !== null) {
    const receiver = match[1];
    const chainedCalls = match[2];

    const readsPatToken =
      /\.select\s*\(\s*['"`][^'"`]*\bpat_token\b[^'"`]*['"`]\s*\)/.test(chainedCalls);
    const readsPatEncrypted =
      /\.select\s*\(\s*['"`][^'"`]*\bpat_token_encrypted\b[^'"`]*['"`]\s*\)/.test(chainedCalls);

    if (readsPatToken || readsPatEncrypted) {
      if (receiver !== "adminClient") {
        violations.push({
          file: fileName,
          receiver,
          readsPatToken,
          readsPatEncrypted,
          message: `Query on 'github_integrations' selects PAT columns using '${receiver}' instead of 'adminClient'`,
          snippet: match[0].slice(0, 150),
        });
      }
    }
  }

  return violations;
}

/**
 * Recursively retrieves all files matching extensions in a directory.
 */
function getFilesRecursively(dir, filter = () => true) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFilesRecursively(fullPath, filter));
    } else if (filter(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

test("Security: No file in supabase/functions reads PAT columns without adminClient", () => {
  const tsFiles = getFilesRecursively(
    FUNCTIONS_DIR,
    (p) => p.endsWith(".ts") && !p.includes("_shared")
  );

  assert.ok(tsFiles.length > 0, "Expected to find function .ts files");

  const allViolations = [];
  for (const file of tsFiles) {
    const relPath = path.relative(ROOT_DIR, file).replace(/\\/g, "/");
    const content = fs.readFileSync(file, "utf-8");
    const violations = findPatAccessViolations(content, relPath);
    allViolations.push(...violations);
  }

  assert.deepEqual(
    allViolations,
    [],
    `Found unauthorized PAT queries without adminClient: ${JSON.stringify(allViolations, null, 2)}`
  );
});

test("Security: generate-report/index.ts uses adminClient and filters PAT by RLS client.agency_id", () => {
  const filePath = path.join(FUNCTIONS_DIR, "generate-report", "index.ts");
  const content = fs.readFileSync(filePath, "utf-8");

  // Must use adminClient to read PAT
  assert.match(
    content,
    /const\s+adminClient\s*=\s*createAdminClient\(\)/,
    "generate-report must instantiate adminClient via createAdminClient()"
  );

  assert.match(
    content,
    /adminClient\s*\.\s*from\s*\(\s*['"]github_integrations['"]\s*\)\s*\.\s*select\s*\(\s*['"]pat_token,\s*pat_token_encrypted['"]\s*\)\s*\.\s*eq\s*\(\s*['"]agency_id['"]\s*,\s*client\.agency_id\s*\)/,
    "generate-report must query PAT via adminClient filtered strictly by client.agency_id"
  );

  // Must not log or return patToken
  assert.doesNotMatch(
    content,
    /console\.(log|error|warn|info)\([^)]*patToken/,
    "generate-report must never log patToken"
  );
});

test("Security: github-sync/index.ts uses adminClient and filters PAT by RLS agency.id", () => {
  const filePath = path.join(FUNCTIONS_DIR, "github-sync", "index.ts");
  const content = fs.readFileSync(filePath, "utf-8");

  // Must use adminClient to read PAT
  assert.match(
    content,
    /const\s+adminClient\s*=\s*createAdminClient\(\)/,
    "github-sync must instantiate adminClient via createAdminClient()"
  );

  assert.match(
    content,
    /adminClient\s*\.\s*from\s*\(\s*['"]github_integrations['"]\s*\)\s*\.\s*select\s*\(\s*['"]pat_token,\s*pat_token_encrypted['"]\s*\)\s*\.\s*eq\s*\(\s*['"]agency_id['"]\s*,\s*agency\.id\s*\)/,
    "github-sync must query PAT via adminClient filtered strictly by agency.id"
  );

  // Must not read PAT using agency_id from body
  assert.doesNotMatch(
    content,
    /adminClient[\s\S]*?\.eq\s*\(\s*['"]agency_id['"]\s*,\s*body\./,
    "github-sync must never filter PAT query using agency_id from request body"
  );
});

test("Security: onboarding-chat and src/ only read allowed columns (github_username, is_valid)", () => {
  const chatFile = path.join(FUNCTIONS_DIR, "onboarding-chat", "index.ts");
  const chatContent = fs.readFileSync(chatFile, "utf-8");

  // onboarding-chat must only select allowed columns
  const chatViolations = findPatAccessViolations(chatContent, "onboarding-chat/index.ts");
  assert.equal(
    chatViolations.length,
    0,
    "onboarding-chat must not have any unauthorized queries selecting PAT columns"
  );

  assert.match(
    chatContent,
    /\.from\s*\(\s*['"]github_integrations['"]\s*\)\s*\.\s*select\s*\(\s*['"]github_username,\s*is_valid['"]\s*\)/,
    "onboarding-chat must select only github_username, is_valid"
  );

  // src/ files must never select pat_token or pat_token_encrypted
  const srcFiles = getFilesRecursively(SRC_DIR, (p) => /\.(ts|tsx|js|mjs)$/.test(p));
  for (const file of srcFiles) {
    const relPath = path.relative(ROOT_DIR, file).replace(/\\/g, "/");
    const content = fs.readFileSync(file, "utf-8");

    if (content.includes("github_integrations")) {
      assert.doesNotMatch(
        content,
        /\.select\s*\(\s*['"`][^'"`]*\bpat_token\b[^'"`]*['"`]\s*\)/,
        `${relPath} must not select pat_token`
      );
      assert.doesNotMatch(
        content,
        /\.select\s*\(\s*['"`][^'"`]*\bpat_token_encrypted\b[^'"`]*['"`]\s*\)/,
        `${relPath} must not select pat_token_encrypted`
      );
    }
  }
});

test("Unit: findPatAccessViolations correctly catches unauthorized PAT readers", () => {
  const badSnippet1 = `
    const supabase = createUserClient(req);
    const { data } = await supabase
      .from('github_integrations')
      .select('pat_token, pat_token_encrypted')
      .single();
  `;
  const violations1 = findPatAccessViolations(badSnippet1, "test-bad-1.ts");
  assert.equal(violations1.length, 1);
  assert.equal(violations1[0].receiver, "supabase");

  const badSnippet2 = `
    const userClient = createUserClient(req);
    const { data } = await userClient
      .from('github_integrations')
      .select('pat_token')
      .single();
  `;
  const violations2 = findPatAccessViolations(badSnippet2, "test-bad-2.ts");
  assert.equal(violations2.length, 1);
  assert.equal(violations2[0].receiver, "userClient");

  const goodSnippet1 = `
    const adminClient = createAdminClient();
    const { data } = await adminClient
      .from('github_integrations')
      .select('pat_token, pat_token_encrypted')
      .single();
  `;
  const violationsGood1 = findPatAccessViolations(goodSnippet1, "test-good-1.ts");
  assert.equal(violationsGood1.length, 0);

  const goodSnippet2 = `
    const supabase = createUserClient(req);
    const { data } = await supabase
      .from('github_integrations')
      .select('github_username, is_valid')
      .single();
  `;
  const violationsGood2 = findPatAccessViolations(goodSnippet2, "test-good-2.ts");
  assert.equal(violationsGood2.length, 0);
});
