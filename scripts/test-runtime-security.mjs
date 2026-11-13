#!/usr/bin/env node

/**
 * ==============================================================================
 * ClientPulse AI — Runtime Security Test: Never Read Source Code (BE-09 / Issue #23)
 * File: scripts/test-runtime-security.mjs
 *
 * ACCEPTANCE CRITERIA:
 * 1. Apenas campos de ProjectV2 são pedidos (All official queries request only ProjectV2 metadata).
 * 2. Allowlist de campos validada em runtime (Runtime allowlist validation rejects unapproved fields).
 * 3. Teste que falha se for pedido conteúdo de ficheiros (Test fails if file content/code is requested).
 * ==============================================================================
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  validateGraphQLQuery,
  executeGitHubGraphQL,
  SecurityError,
  ALLOWED_GRAPHQL_FIELDS,
  FORBIDDEN_SOURCE_CODE_FIELDS,
} from "../supabase/functions/_shared/github.ts";

test("BE-09: Allowlist and Blocklist sets must be correctly configured", () => {
  assert.ok(ALLOWED_GRAPHQL_FIELDS.has("ProjectV2"));
  assert.ok(ALLOWED_GRAPHQL_FIELDS.has("items"));
  assert.ok(ALLOWED_GRAPHQL_FIELDS.has("title"));
  assert.ok(FORBIDDEN_SOURCE_CODE_FIELDS.has("blob"));
  assert.ok(FORBIDDEN_SOURCE_CODE_FIELDS.has("tree"));
  assert.ok(FORBIDDEN_SOURCE_CODE_FIELDS.has("repository"));
});

test("BE-09: Official ClientPulse AI queries must pass runtime validation", () => {
  // Query 1: Viewer / Token test
  const viewerQuery = `
    query {
      viewer {
        login
        name
        avatarUrl
      }
    }
  `;
  assert.doesNotThrow(() => validateGraphQLQuery(viewerQuery));

  // Query 2: List ProjectsV2 (Organization)
  const listOrgQuery = `
    query($login: String!, $first: Int!) {
      organization(login: $login) {
        projectsV2(first: $first) {
          nodes {
            id
            number
            title
            closed
            url
            shortDescription
            updatedAt
          }
        }
      }
    }
  `;
  assert.doesNotThrow(() => validateGraphQLQuery(listOrgQuery));

  // Query 2b: List ProjectsV2 (User)
  const listUserQuery = `
    query($login: String!, $first: Int!) {
      user(login: $login) {
        projectsV2(first: $first) {
          nodes {
            id
            number
            title
            closed
            url
            shortDescription
            updatedAt
          }
        }
      }
    }
  `;
  assert.doesNotThrow(() => validateGraphQLQuery(listUserQuery));

  // Query 3: Fetch Project Columns
  const columnsQuery = `
    query($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          title
          fields(first: 30) {
            nodes {
              ... on ProjectV2SingleSelectField {
                id
                name
                options {
                  id
                  name
                  color
                }
              }
            }
          }
        }
      }
    }
  `;
  assert.doesNotThrow(() => validateGraphQLQuery(columnsQuery));

  // Query 4: Fetch Board Tasks (Issue, PR, DraftIssue metadata)
  const tasksQuery = `
    query($projectId: ID!, $first: Int!, $after: String) {
      node(id: $projectId) {
        ... on ProjectV2 {
          items(first: $first, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              updatedAt
              fieldValues(first: 15) {
                nodes {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                    field {
                      ... on ProjectV2SingleSelectField {
                        name
                      }
                    }
                  }
                }
              }
              content {
                ... on Issue {
                  id
                  number
                  title
                  bodyText
                  state
                  closedAt
                  updatedAt
                  url
                  assignees(first: 5) {
                    nodes {
                      login
                    }
                  }
                  labels(first: 10) {
                    nodes {
                      name
                    }
                  }
                }
                ... on PullRequest {
                  id
                  number
                  title
                  bodyText
                  state
                  closedAt
                  updatedAt
                  url
                  assignees(first: 5) {
                    nodes {
                      login
                    }
                  }
                }
                ... on DraftIssue {
                  id
                  title
                  body
                  updatedAt
                }
              }
            }
          }
        }
      }
    }
  `;
  assert.doesNotThrow(() => validateGraphQLQuery(tasksQuery));
});

test("BE-09: Fails immediately if repository source code or file contents are requested (Blob.text)", () => {
  const fileContentQuery = `
    query {
      repository(owner: "client", name: "private-app") {
        object(expression: "HEAD:src/config/database.ts") {
          ... on Blob {
            text
            byteSize
          }
        }
      }
    }
  `;

  assert.throws(
    () => validateGraphQLQuery(fileContentQuery),
    (err) => {
      assert.ok(err instanceof SecurityError, "Must be an instance of SecurityError");
      assert.match(
        err.message,
        /Runtime security violation.*forbidden source code/i,
        "Error message must specify runtime security violation for forbidden code"
      );
      return true;
    }
  );
});

test("BE-09: Fails immediately if git trees or repository directory entries are requested", () => {
  const treeQuery = `
    query {
      repository(owner: "client", name: "private-app") {
        tree(expression: "HEAD:") {
          entries {
            name
            type
          }
        }
      }
    }
  `;

  assert.throws(
    () => validateGraphQLQuery(treeQuery),
    (err) => {
      assert.ok(err instanceof SecurityError);
      assert.match(err.message, /forbidden source code|not in the allowed ProjectV2 allowlist/i);
      return true;
    }
  );
});

test("BE-09: Fails immediately if commit history, diffs or patches are requested", () => {
  const commitQuery = `
    query {
      repository(owner: "client", name: "private-app") {
        defaultBranchRef {
          target {
            ... on Commit {
              history(first: 10) {
                nodes {
                  message
                  diff
                }
              }
            }
          }
        }
      }
    }
  `;

  assert.throws(
    () => validateGraphQLQuery(commitQuery),
    (err) => {
      assert.ok(err instanceof SecurityError);
      return true;
    }
  );
});

test("BE-09: Fails immediately if arbitrary unauthorized fields outside the allowlist are requested", () => {
  const unknownFieldQuery = `
    query {
      viewer {
        login
        secretInternalAuditLog
      }
    }
  `;

  assert.throws(
    () => validateGraphQLQuery(unknownFieldQuery),
    (err) => {
      assert.ok(err instanceof SecurityError);
      assert.match(err.message, /secretInternalAuditLog.*not in the allowed ProjectV2 allowlist/i);
      return true;
    }
  );
});

test("BE-09: executeGitHubGraphQL blocks file content requests BEFORE initiating any network request", async () => {
  const maliciousQuery = `
    query {
      repository(owner: "victim", name: "repo") {
        object(expression: "HEAD:secrets.env") {
          ... on Blob {
            text
          }
        }
      }
    }
  `;

  await assert.rejects(
    async () => {
      await executeGitHubGraphQL("dummy_token", maliciousQuery);
    },
    (err) => {
      assert.ok(err instanceof SecurityError);
      assert.match(err.message, /Runtime security violation/i);
      return true;
    }
  );
});

console.log("🔒 [test-runtime-security] Todos os testes de segurança em runtime foram definidos com sucesso.");
