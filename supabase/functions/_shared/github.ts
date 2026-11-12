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
 * Executes a raw GraphQL query against the GitHub API.
 */
export async function executeGitHubGraphQL(pat: string, query: string, variables: Record<string, unknown> = {}) {
  const response = await fetch(GITHUB_GRAPHQL_ENDPOINT, {
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

  const result = await response.json();

  if (result.errors && result.errors.length > 0) {
    const errorMsg = result.errors.map((e: { message: string }) => e.message).join(' | ');
    throw new Error(`GitHub GraphQL Error: ${errorMsg}`);
  }

  return result.data;
}

/**
 * 1. Test PAT connection and retrieve user profile info.
 */
export async function testGitHubToken(pat: string) {
  const cleanPat = pat.trim();
  if (
    cleanPat.startsWith('github_pat_mock') ||
    cleanPat.startsWith('github_pat_demo') ||
    cleanPat.startsWith('ghp_mock') ||
    cleanPat.startsWith('ghp_demo') ||
    cleanPat.startsWith('demo_pat_')
  ) {
    if (cleanPat.includes('invalid') || cleanPat.includes('expired')) {
      throw new Error('Invalid GitHub Personal Access Token (401 Bad Credentials).');
    }
    return {
      valid: true,
      username: 'maria-agency',
      name: 'Maria Silva',
      avatarUrl: 'https://avatars.githubusercontent.com/u/123456',
    };
  }

  const query = `
    query {
      viewer {
        login
        name
        avatarUrl
      }
    }
  `;

  const data = await executeGitHubGraphQL(cleanPat, query);
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

/**
 * 4. Fetch all board items and categorize them using the client's column mapping.
 */
export async function fetchBoardTasks(
  pat: string,
  projectId: string,
  columnMapping: { done?: string[]; in_progress?: string[]; blocked?: string[] } = {},
  daysAgo: number = 7
): Promise<{
  all: GitHubTaskItem[];
  done: GitHubTaskItem[];
  inProgress: GitHubTaskItem[];
  blocked: GitHubTaskItem[];
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
                  body
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
                  body
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

  // Normalize column mapping names to lowercase for comparison
  const doneColumns = (columnMapping.done ?? ['done', 'concluído', 'concluido']).map((c) => c.toLowerCase());
  const inProgressColumns = (columnMapping.in_progress ?? ['in progress', 'em progresso', 'em curso']).map((c) => c.toLowerCase());
  const blockedColumns = (columnMapping.blocked ?? ['blocked', 'bloqueado', 'needs review', 'impedimento']).map((c) => c.toLowerCase());

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

    // Determine status category
    const lowerStatus = statusName.toLowerCase();
    let category: 'done' | 'in_progress' | 'blocked' | 'other' = 'other';

    if (doneColumns.includes(lowerStatus)) {
      category = 'done';
    } else if (inProgressColumns.includes(lowerStatus)) {
      category = 'in_progress';
    } else if (blockedColumns.includes(lowerStatus)) {
      category = 'blocked';
    }

    // Extract metadata
    const assignees = content.assignees?.nodes?.map((a: { login: string }) => a.login) ?? [];
    const labels = content.labels?.nodes?.map((l: { name: string }) => l.name) ?? [];
    const closedAt = content.closedAt ?? null;
    const updatedAt = content.updatedAt ?? item.updatedAt;

    parsedTasks.push({
      id: content.id ?? item.id,
      title: content.title ?? 'Untitled Card',
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
  const done = parsedTasks.filter((t) => t.statusCategory === 'done');
  const inProgress = parsedTasks.filter((t) => t.statusCategory === 'in_progress');
  const blocked = parsedTasks.filter((t) => t.statusCategory === 'blocked');

  return {
    all: parsedTasks,
    done,
    inProgress,
    blocked,
  };
}
