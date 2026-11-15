// ==============================================================================
// ClientPulse AI — GitHub Projects v2 GraphQL Client
// File: supabase/functions/_shared/github.ts
//
// WHY GRAPHQL?
// Modern GitHub Projects (Projects v2) do not exist in the traditional REST API.
// GitHub requires the GraphQL API (https://api.github.com/graphql).
//
// This module handles:
// 1. Token validation (checking if the PAT is valid and has read permissions)
// 2. Listing user/organization Projects v2
// 3. Fetching board columns (Status field single-select options)
// 4. Fetching board cards/issues with metadata (title, status, assignees, labels)
// ==============================================================================

const GITHUB_GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';

/**
 * Standard interface for task items extracted from GitHub Projects v2.
 */
export interface GitHubTaskItem {
  id: string;
  title: string;
  description?: string | null;
  status: string; // The raw column name on GitHub (e.g. "Done", "In Progress")
  statusCategory: 'done' | 'in_progress' | 'blocked' | 'other';
  assignee: string | null;
  labels: string[];
  updatedAt: string;
  closedAt: string | null;
  itemType: 'issue' | 'pull_request' | 'draft_issue';
  url?: string;
}

/**
 * Strips code fences, backticks, HTML tags and collapses whitespace
 * from task descriptions to prevent code leakage and minimize tokens sent to external AI (Issue #51).
 */
export function sanitizeTaskDescription(raw: string | null | undefined, maxChars = 300): string | null {
  if (!raw) return null;
  const stripped = raw
    .replace(/```[\s\S]*?```/g, '') // remove multi-line code fences to prevent code leakage
    .replace(/`[^`]*`/g, '')        // remove inline code spans
    .replace(/<[^>]*>/g, '')        // remove HTML tags
    .replace(/\s+/g, ' ')           // collapse whitespace
    .trim();
  if (!stripped) return null;
  return stripped.length > maxChars ? `${stripped.slice(0, maxChars)}...` : stripped;
}

/**
 * SecurityError thrown when a runtime security constraint is violated (BE-09).
 */
export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

/**
 * Error thrown when GitHub rate limit / secondary rate limit is exceeded (BE-08).
 */
export class GitHubRateLimitError extends Error {
  code = 'GITHUB_RATE_LIMITED';
  constructor(message = 'O GitHub limitou temporariamente os pedidos. Tenta de novo dentro de alguns minutos.') {
    super(message);
    this.name = 'GitHubRateLimitError';
  }
}

export interface RateLimitDetection {
  isRateLimited: boolean;
  retryAfterSeconds?: number;
  resetEpochSeconds?: number;
  reason?: string;
}

/**
 * Detects if a GitHub API response corresponds to primary or secondary rate limits (BE-08).
 */
export function detectGitHubRateLimit(
  status: number,
  headers: Headers | Record<string, string | null | undefined> | undefined,
  bodyJson?: any
): RateLimitDetection {
  const getHeader = (name: string): string | null => {
    if (!headers) return null;
    if (typeof (headers as Headers).get === 'function') {
      return (headers as Headers).get(name);
    }
    const lower = name.toLowerCase();
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === lower) return v ?? null;
    }
    return null;
  };

  const remaining = getHeader('x-ratelimit-remaining');
  const retryAfter = getHeader('retry-after');
  const reset = getHeader('x-ratelimit-reset');

  const retryAfterSec = retryAfter ? parseInt(retryAfter, 10) : undefined;
  const resetSec = reset ? parseInt(reset, 10) : undefined;

  // 1. Check GraphQL response body errors for RATE_LIMITED or secondary rate limit messages
  if (bodyJson && Array.isArray(bodyJson.errors)) {
    for (const err of bodyJson.errors) {
      if (err.type === 'RATE_LIMITED') {
        return {
          isRateLimited: true,
          retryAfterSeconds: retryAfterSec,
          resetEpochSeconds: resetSec,
          reason: 'graphql_rate_limited_type',
        };
      }
      const msg = typeof err.message === 'string' ? err.message.toLowerCase() : '';
      if (
        msg.includes('rate limit') ||
        msg.includes('secondary rate limit') ||
        msg.includes('abuse detection')
      ) {
        return {
          isRateLimited: true,
          retryAfterSeconds: retryAfterSec,
          resetEpochSeconds: resetSec,
          reason: 'graphql_error_message',
        };
      }
    }
  }

  // 2. HTTP 429 is always Too Many Requests
  if (status === 429) {
    return {
      isRateLimited: true,
      retryAfterSeconds: retryAfterSec,
      resetEpochSeconds: resetSec,
      reason: 'http_429',
    };
  }

  // 3. HTTP 403 with x-ratelimit-remaining: 0, Retry-After, or secondary rate limit message
  if (status === 403) {
    if (remaining === '0' || (retryAfterSec !== undefined && !Number.isNaN(retryAfterSec))) {
      return {
        isRateLimited: true,
        retryAfterSeconds: retryAfterSec,
        resetEpochSeconds: resetSec,
        reason: 'http_403_rate_limit_headers',
      };
    }

    const bodyMsg = typeof bodyJson?.message === 'string' ? bodyJson.message.toLowerCase() : '';
    if (
      bodyMsg.includes('secondary rate limit') ||
      bodyMsg.includes('rate limit') ||
      bodyMsg.includes('abuse detection')
    ) {
      return {
        isRateLimited: true,
        retryAfterSeconds: retryAfterSec,
        resetEpochSeconds: resetSec,
        reason: 'http_403_rate_limit_body',
      };
    }
  }

  return { isRateLimited: false };
}

export interface GraphQLRequestOptions {
  fetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<void>;
  maxRetries?: number;
  maxTotalWaitMs?: number;
  nowFn?: () => number;
}

/**
 * Set of allowed GraphQL selection fields and types for GitHub Projects v2 operations (BE-09).
 * Only fields relevant to Project boards, cards and metadata are permitted.
 * Source code, files, blobs, git trees and commits are strictly excluded.
 */
export const ALLOWED_GRAPHQL_FIELDS: ReadonlySet<string> = new Set([
  // Root queries & scopes
  'viewer',
  'user',
  'organization',
  'node',

  // ProjectV2 types & fields
  'ProjectV2',
  'projectsV2',
  'fields',
  'ProjectV2SingleSelectField',
  'options',
  'color',
  'items',
  'fieldValues',
  'ProjectV2ItemFieldSingleSelectValue',
  'field',

  // Card Content & Task Metadata
  'content',
  'Issue',
  'PullRequest',
  'DraftIssue',
  'assignees',
  'labels',

  // Pagination & Node wrappers
  'pageInfo',
  'hasNextPage',
  'endCursor',
  'nodes',

  // Metadata attributes
  'id',
  'number',
  'title',
  'name',
  'login',
  'avatarUrl',
  'closed',
  'state',
  'url',
  'shortDescription',
  'body',
  'bodyText',
  'updatedAt',
  'closedAt',
]);

/**
 * Set of forbidden source code, repository file, git tree and commit terms (BE-09).
 * Querying any of these fields triggers an immediate SecurityError rejection.
 */
export const FORBIDDEN_SOURCE_CODE_FIELDS: ReadonlySet<string> = new Set([
  'repository',
  'repositories',
  'blob',
  'blobs',
  'tree',
  'trees',
  'object',
  'objects',
  'entries',
  'entry',
  'file',
  'files',
  'text',
  'byteSize',
  'isBinary',
  'commit',
  'commits',
  'history',
  'diff',
  'patch',
  'blame',
  'ref',
  'refs',
  'defaultBranchRef',
  'target',
  'tarballUrl',
  'zipballUrl',
  'submodule',
  'release',
  'releases',
  'deployKey',
  'deployKeys',
  'collaborators',
]);

const GRAPHQL_KEYWORDS: ReadonlySet<string> = new Set([
  'query',
  'mutation',
  'subscription',
  'fragment',
  'on',
  'true',
  'false',
  'null',
  'String',
  'Int',
  'Float',
  'Boolean',
  'ID',
]);

/**
 * Validates a GraphQL query string at runtime against the strict ProjectV2 allowlist (BE-09).
 * Throws a SecurityError if the query requests source code, repository files, git trees,
 * or any unauthorized field outside the allowlist.
 */
export function validateGraphQLQuery(query: string): void {
  if (!query || typeof query !== 'string') {
    throw new SecurityError('Runtime security violation: GraphQL query must be a non-empty string.');
  }

  // 1. Direct blocklist check for forbidden repository & source code terms (Defense in Depth)
  for (const forbidden of FORBIDDEN_SOURCE_CODE_FIELDS) {
    const regex = new RegExp(`\\b${forbidden}\\b`, 'i');
    if (regex.test(query)) {
      throw new SecurityError(
        `Runtime security violation: GraphQL query attempts to access forbidden source code / repository field: '${forbidden}'. ClientPulse AI policy strictly prohibits reading repository files or source code.`
      );
    }
  }

  // 2. Extract structural selections & identifiers
  // Strip comments
  let sanitized = query.replace(/#[^\r\n]*/g, '');
  // Strip string literals
  sanitized = sanitized.replace(/"(?:\\.|[^"\\])*"/g, '');
  // Strip variable / argument lists in parentheses (e.g. `(id: $projectId, first: 10)`)
  sanitized = sanitized.replace(/\([^)]*\)/g, '');
  // Strip variable references ($foo)
  sanitized = sanitized.replace(/\$[a-zA-Z0-9_]+/g, '');
  // Strip directives (@foo)
  sanitized = sanitized.replace(/@[a-zA-Z0-9_]+/g, '');

  const tokens = sanitized.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];

  // 3. Verify every identifier against allowlist & GraphQL keywords
  for (const token of tokens) {
    if (GRAPHQL_KEYWORDS.has(token)) {
      continue;
    }

    if (!ALLOWED_GRAPHQL_FIELDS.has(token)) {
      throw new SecurityError(
        `Runtime security violation: Field or type '${token}' is not in the allowed ProjectV2 allowlist. Reading source code or unauthorized fields is strictly prohibited.`
      );
    }
  }
}

/**
 * Executes a raw GraphQL query against the GitHub API with automatic rate-limit detection,
 * Retry-After / reset handling, and exponential backoff retry (BE-08 / BE-09).
 */
export async function executeGitHubGraphQL(
  pat: string,
  query: string,
  variables: Record<string, unknown> = {},
  options?: GraphQLRequestOptions
) {
  // Runtime Security Validation (Issue #23 / BE-09):
  // Strictly verifies that the query contains ONLY allowed ProjectV2 fields
  // and NEVER requests repository source code, file blobs, or git trees.
  validateGraphQLQuery(query);

  const fetchFn = options?.fetchFn ?? fetch;
  const sleepFn = options?.sleepFn ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const nowFn = options?.nowFn ?? Date.now;
  const maxRetries = options?.maxRetries ?? 2;
  const maxTotalWaitMs = options?.maxTotalWaitMs ?? 20000;

  let totalWaitMs = 0;
  let attempt = 0;

  while (true) {
    const response = await fetchFn(GITHUB_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pat.trim()}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ClientPulse-AI/1.0',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (response.status === 401) {
      throw new Error('Invalid GitHub Personal Access Token (401 Bad Credentials).');
    }

    let result: any = null;
    let rawText = '';
    try {
      rawText = await response.text();
      result = rawText ? JSON.parse(rawText) : null;
    } catch {
      // not JSON
    }

    // Rate Limit Detection (BE-08)
    const rateLimitInfo = detectGitHubRateLimit(response.status, response.headers, result);

    if (rateLimitInfo.isRateLimited) {
      if (attempt >= maxRetries) {
        throw new GitHubRateLimitError();
      }

      // Calculate wait time respecting Retry-After or x-ratelimit-reset
      let waitMs = 0;
      if (rateLimitInfo.retryAfterSeconds !== undefined && rateLimitInfo.retryAfterSeconds > 0) {
        waitMs = rateLimitInfo.retryAfterSeconds * 1000;
      } else if (rateLimitInfo.resetEpochSeconds !== undefined && rateLimitInfo.resetEpochSeconds > 0) {
        const nowSec = nowFn() / 1000;
        const diffSec = rateLimitInfo.resetEpochSeconds - nowSec;
        waitMs = Math.max(1000, Math.ceil(diffSec) * 1000);
      } else {
        // Backoff exponencial com jitter
        const baseMs = 1000 * Math.pow(2, attempt);
        const jitterMs = Math.floor(Math.random() * 500);
        waitMs = baseMs + jitterMs;
      }

      // Teto de 20s no total
      if (totalWaitMs + waitMs > maxTotalWaitMs) {
        throw new GitHubRateLimitError();
      }

      await sleepFn(waitMs);
      totalWaitMs += waitMs;
      attempt++;
      continue;
    }

    if (!response.ok) {
      const errorMsg = result?.message || rawText || `HTTP ${response.status}`;
      throw new Error(`GitHub API Error: ${errorMsg}`);
    }

    if (result?.errors && result.errors.length > 0) {
      const errorMsg = result.errors.map((e: { message: string }) => e.message).join(' | ');
      throw new Error(`GitHub GraphQL Error: ${errorMsg}`);
    }

    return result?.data;
  }
}

/**
 * 1. Test PAT connection and retrieve user profile info.
 */
export async function testGitHubToken(pat: string) {
  const query = `
    query {
      viewer {
        login
        name
        avatarUrl
      }
    }
  `;

  const data = await executeGitHubGraphQL(pat, query);
  return {
    valid: true,
    username: data.viewer.login,
    name: data.viewer.name ?? data.viewer.login,
    avatarUrl: data.viewer.avatarUrl,
  };
}

/**
 * 2. List Projects v2 for a given User or Organization.
 */
export async function listProjects(
  pat: string,
  owner: string,
  ownerType: 'user' | 'organization' = 'user',
  first: number = 20
) {
  const isOrg = ownerType === 'organization';
  const query = isOrg
    ? `
      query($login: String!, $first: Int!) {
        organization(login: $login) {
          projectsV2(first: $first) {
            nodes {
              id
              number
              title
              closed
              url
            }
          }
        }
      }
    `
    : `
      query($login: String!, $first: Int!) {
        user(login: $login) {
          projectsV2(first: $first) {
            nodes {
              id
              number
              title
              closed
              url
            }
          }
        }
      }
    `;

  const data = await executeGitHubGraphQL(pat, query, { login: owner, first });
  const container = isOrg ? data.organization : data.user;

  if (!container) {
    throw new Error(`GitHub ${ownerType} '${owner}' not found or you do not have permission to view it.`);
  }

  const projects = container.projectsV2?.nodes ?? [];
  return projects.map((p: { id: string; number: number; title: string; closed: boolean; url: string }) => ({
    id: p.id,
    number: p.number,
    title: p.title,
    closed: p.closed,
    url: p.url,
  }));
}

/**
 * 3. Fetch board columns (Single Select Status field options).
 */
export async function fetchProjectColumns(pat: string, projectId: string) {
  const query = `
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
                  description
                  color
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await executeGitHubGraphQL(pat, query, { projectId });
  const project = data.node;

  if (!project) {
    throw new Error(`Project with ID '${projectId}' was not found.`);
  }

  // Find the single-select field representing Status (usually named "Status")
  const fields = project.fields?.nodes ?? [];
  const statusField = fields.find((f: { name?: string }) => 
    f?.name?.toLowerCase() === 'status' || f?.name?.toLowerCase() === 'estado'
  ) ?? fields[0];

  if (!statusField || !statusField.options) {
    return {
      fieldId: null,
      fieldName: 'None',
      columns: [],
    };
  }

  return {
    fieldId: statusField.id,
    fieldName: statusField.name,
    columns: statusField.options.map((opt: { id: string; name: string; color: string }) => ({
      id: opt.id,
      name: opt.name,
      color: opt.color,
    })),
  };
}

export interface ColumnMappingConfig {
  done?: string[] | string;
  in_progress?: string[] | string;
  blocked?: string[] | string;
}

/**
 * Categorizes a task's status into one of the 3 report categories ('done', 'in_progress', 'blocked')
 * or 'other' (unmapped / ignored).
 * Normalizes input cases, trims whitespace, and supports array or string configuration (BE-07 / Issue #21).
 */
export function categorizeTaskStatus(
  statusName: string,
  mapping: ColumnMappingConfig = {}
): 'done' | 'in_progress' | 'blocked' | 'other' {
  const normalize = (cols: unknown, defaults: string[]): string[] => {
    if (Array.isArray(cols)) return cols.map((c) => String(c).trim().toLowerCase()).filter(Boolean);
    if (typeof cols === 'string' && cols.trim()) return [cols.trim().toLowerCase()];
    return defaults.map((d) => d.toLowerCase());
  };

  const doneCols = normalize(mapping.done, ['done', 'concluído', 'concluido', 'complete', 'finished']);
  const inProgCols = normalize(mapping.in_progress, ['in progress', 'em progresso', 'em curso', 'doing']);
  const blockedCols = normalize(mapping.blocked, ['blocked', 'bloqueado', 'needs review', 'impedimento']);

  const lower = (statusName || '').trim().toLowerCase();
  if (doneCols.includes(lower)) return 'done';
  if (inProgCols.includes(lower)) return 'in_progress';
  if (blockedCols.includes(lower)) return 'blocked';
  return 'other';
}

/**
 * 4. Fetch all board items and categorize them using the client's column mapping.
 */
export async function fetchBoardTasks(
  pat: string,
  projectId: string,
  columnMapping: ColumnMappingConfig = {},
  daysAgo: number = 7
): Promise<{
  all: GitHubTaskItem[];
  done: GitHubTaskItem[];
  inProgress: GitHubTaskItem[];
  blocked: GitHubTaskItem[];
  other: GitHubTaskItem[];
  unmappedColumns: string[];
  ignoredTasksCount: number;
}> {
  const query = `
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

  // Cursor-based pagination: fetch all pages of board items
  const rawItems: Array<{
    id: string;
    updatedAt: string;
    fieldValues?: { nodes?: Array<{ name?: string; field?: { name?: string } }> };
    content?: {
      id?: string;
      number?: number;
      title?: string;
      bodyText?: string;
      body?: string;
      state?: string;
      closedAt?: string | null;
      updatedAt?: string;
      url?: string;
      assignees?: { nodes?: Array<{ login: string }> };
      labels?: { nodes?: Array<{ name: string }> };
    };
  }> = [];

  let hasNextPage = true;
  let cursor: string | null = null;
  const maxPages = 10; // Safety guard: fetches up to 1000 items
  let pageCount = 0;

  while (hasNextPage && pageCount < maxPages) {
    pageCount++;
    const data = await executeGitHubGraphQL(pat, query, {
      projectId,
      first: 100,
      after: cursor,
    });

    const itemsConnection = data.node?.items;
    const pageNodes = itemsConnection?.nodes ?? [];
    rawItems.push(...pageNodes);

    hasNextPage = Boolean(itemsConnection?.pageInfo?.hasNextPage);
    cursor = itemsConnection?.pageInfo?.endCursor ?? null;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

  const parsedTasks: GitHubTaskItem[] = [];

  for (const item of rawItems) {
    const content = item.content;
    if (!content) continue; // Skip empty card slots

    // Extract status from fieldValues
    let statusName = 'No Status';
    const fieldValues = item.fieldValues?.nodes ?? [];
    for (const fv of fieldValues) {
      if (fv?.name && fv?.field?.name?.toLowerCase() === 'status') {
        statusName = fv.name;
        break;
      }
    }

    // Determine status category via dynamic mapping (BE-07)
    const category = categorizeTaskStatus(statusName, columnMapping);

    // Extract metadata
    const assignees = content.assignees?.nodes?.map((a: { login: string }) => a.login) ?? [];
    const labels = content.labels?.nodes?.map((l: { name: string }) => l.name) ?? [];
    const closedAt = content.closedAt ?? null;
    const updatedAt = content.updatedAt ?? item.updatedAt;
    const description = sanitizeTaskDescription(content.bodyText ?? content.body);

    parsedTasks.push({
      id: content.id ?? item.id,
      title: content.title ?? 'Untitled Card',
      description,
      status: statusName,
      statusCategory: category,
      assignee: assignees.length > 0 ? assignees.join(', ') : null,
      labels,
      updatedAt,
      closedAt,
      itemType: content.number ? (content.url?.includes('/pull/') ? 'pull_request' : 'issue') : 'draft_issue',
      url: content.url,
    });
  }

  // Filter tasks:
  // - Done: items marked done that were closed or updated within the last 7 days (or currently in Done)
  // - In Progress: items currently in progress
  // - Blocked: items currently blocked
  // - Other: unmapped items ignored with notice
  const done = parsedTasks.filter((t) => t.statusCategory === 'done');
  const inProgress = parsedTasks.filter((t) => t.statusCategory === 'in_progress');
  const blocked = parsedTasks.filter((t) => t.statusCategory === 'blocked');
  const other = parsedTasks.filter((t) => t.statusCategory === 'other');

  // Identify distinct unmapped columns that contained actual cards
  const unmappedColumns = Array.from(
    new Set(
      other
        .map((t) => t.status)
        .filter((s) => s && s !== 'No Status')
    )
  );

  if (unmappedColumns.length > 0) {
    console.warn(
      `[github] Aviso: ${other.length} tarefas ignoradas por pertencerem a colunas não mapeadas: ${unmappedColumns.join(', ')}.`
    );
  }

  return {
    all: parsedTasks,
    done,
    inProgress,
    blocked,
    other,
    unmappedColumns,
    ignoredTasksCount: other.length,
  };
}
