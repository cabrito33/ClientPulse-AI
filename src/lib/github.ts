/**
 * Extension point: GitHub Projects sync.
 *
 * The prototype reads demo cards. In production, `listProjects` and
 * `fetchSprintItems` call the GitHub GraphQL API with the OAuth token of the
 * professional, mapping ProjectV2 columns to our three states. Only issues
 * and their metadata are read — never repository contents.
 */

export interface GithubProject {
  id: string;
  title: string;
  columns: string[];
}

export interface GithubItem {
  id: string;
  title: string;
  status: "done" | "in_progress" | "blocked";
  labels: string[];
  updatedAt: string;
}

const GH_API = "https://api.github.com/graphql";

export function isGithubConfigured(): boolean {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

/** Demo projects, used by the onboarding assistant. */
export const demoProjects: GithubProject[] = [
  {
    id: "PVT_demo_atelier",
    title: "Website 2026 — Atelier Mira",
    columns: ["Backlog", "Em curso", "Em revisão", "Bloqueado", "Concluído"],
  },
  {
    id: "PVT_demo_vitalis",
    title: "Portal do Paciente — Fase 2",
    columns: ["A fazer", "A desenvolver", "Em testes", "Bloqueado", "Entregue"],
  },
  {
    id: "PVT_demo_mare",
    title: "Loja online — Shopify headless",
    columns: ["Ideias", "A fazer", "Em curso", "Bloqueado", "Pronto"],
  },
];

const DEMO_QUERY = `
  query ProjectItems($projectId: ID!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        items(first: 100) {
          nodes {
            fieldValues(first: 20) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue { name }
              }
            }
            content {
              ... on Issue {
                number
                title
                labels(first: 5) { nodes { name } }
                updatedAt
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Fetches project items via GraphQL. Kept inert until credentials exist so the
 * prototype never makes an outbound call.
 */
export async function fetchSprintItems(projectId: string, token?: string): Promise<GithubItem[]> {
  if (!token || !isGithubConfigured()) return [];
  const res = await fetch(GH_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: DEMO_QUERY, variables: { projectId } }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub GraphQL: ${res.status}`);
  // TODO(fase 2): normalise response → GithubItem[] using the column mapping
  // chosen by the user during onboarding.
  return [];
}
