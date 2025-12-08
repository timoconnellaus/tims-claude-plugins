/**
 * Linear API client using GraphQL
 */

import {
  LinearIssue,
  TestLink,
  IssueTestLinks,
  TEST_LINK_COMMENT_MARKER,
  TEST_LINK_COMMENT_END,
} from "./types";

const LINEAR_API_URL = "https://api.linear.app/graphql";

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
}

export interface LinearProject {
  id: string;
  name: string;
}

export interface LinearComment {
  id: string;
  body: string;
}

async function graphql<T>(
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(LINEAR_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Linear API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  if (json.errors) {
    throw new Error(`Linear GraphQL error: ${json.errors[0].message}`);
  }

  return json.data;
}

/**
 * Verify API key is valid
 */
export async function verifyApiKey(apiKey: string): Promise<boolean> {
  try {
    await graphql(apiKey, `query { viewer { id } }`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all teams for the authenticated user
 */
export async function getTeams(apiKey: string): Promise<LinearTeam[]> {
  const data = await graphql<{ teams: { nodes: LinearTeam[] } }>(
    apiKey,
    `query {
      teams {
        nodes {
          id
          name
          key
        }
      }
    }`
  );
  return data.teams.nodes;
}

/**
 * Get projects for a team
 */
export async function getProjects(
  apiKey: string,
  teamId: string
): Promise<LinearProject[]> {
  const data = await graphql<{ team: { projects: { nodes: LinearProject[] } } }>(
    apiKey,
    `query($teamId: String!) {
      team(id: $teamId) {
        projects {
          nodes {
            id
            name
          }
        }
      }
    }`,
    { teamId }
  );
  return data.team.projects.nodes;
}

/**
 * Fetch issues from a team with optional filters
 */
export async function getIssues(
  apiKey: string,
  teamId: string,
  options?: {
    projectId?: string;
    states?: string[];
    labels?: string[];
  }
): Promise<LinearIssue[]> {
  // Build filter
  const filters: string[] = [`team: { id: { eq: "${teamId}" } }`];

  if (options?.projectId) {
    filters.push(`project: { id: { eq: "${options.projectId}" } }`);
  }

  if (options?.states?.length) {
    const stateFilter = options.states.map(s => `"${s}"`).join(", ");
    filters.push(`state: { name: { in: [${stateFilter}] } }`);
  }

  if (options?.labels?.length) {
    const labelFilter = options.labels.map(l => `"${l}"`).join(", ");
    filters.push(`labels: { name: { in: [${labelFilter}] } }`);
  }

  const filterStr = filters.join(", ");

  const data = await graphql<{
    issues: {
      nodes: Array<{
        id: string;
        identifier: string;
        title: string;
        description?: string;
        state: { name: string; type: string };
        priority: number;
        labels: { nodes: Array<{ name: string }> };
        assignee?: { displayName: string };
        url: string;
        updatedAt: string;
      }>;
    };
  }>(
    apiKey,
    `query {
      issues(filter: { ${filterStr} }, first: 250) {
        nodes {
          id
          identifier
          title
          description
          state {
            name
            type
          }
          priority
          labels {
            nodes {
              name
            }
          }
          assignee {
            displayName
          }
          url
          updatedAt
        }
      }
    }`
  );

  return data.issues.nodes.map((issue) => ({
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description,
    state: issue.state,
    priority: issue.priority,
    labels: issue.labels.nodes.map((l) => l.name),
    assignee: issue.assignee?.displayName,
    url: issue.url,
    updatedAt: issue.updatedAt,
  }));
}

/**
 * Get comments for an issue
 */
export async function getIssueComments(
  apiKey: string,
  issueId: string
): Promise<LinearComment[]> {
  const data = await graphql<{
    issue: { comments: { nodes: LinearComment[] } };
  }>(
    apiKey,
    `query($issueId: String!) {
      issue(id: $issueId) {
        comments {
          nodes {
            id
            body
          }
        }
      }
    }`,
    { issueId }
  );
  return data.issue.comments.nodes;
}

/**
 * Create a comment on an issue
 */
export async function createComment(
  apiKey: string,
  issueId: string,
  body: string
): Promise<string> {
  const data = await graphql<{ commentCreate: { comment: { id: string } } }>(
    apiKey,
    `mutation($issueId: String!, $body: String!) {
      commentCreate(input: { issueId: $issueId, body: $body }) {
        comment {
          id
        }
      }
    }`,
    { issueId, body }
  );
  return data.commentCreate.comment.id;
}

/**
 * Update an existing comment
 */
export async function updateComment(
  apiKey: string,
  commentId: string,
  body: string
): Promise<void> {
  await graphql(
    apiKey,
    `mutation($commentId: String!, $body: String!) {
      commentUpdate(id: $commentId, input: { body: $body }) {
        comment {
          id
        }
      }
    }`,
    { commentId, body }
  );
}

/**
 * Delete a comment
 */
export async function deleteComment(
  apiKey: string,
  commentId: string
): Promise<void> {
  await graphql(
    apiKey,
    `mutation($commentId: String!) {
      commentDelete(id: $commentId) {
        success
      }
    }`,
    { commentId }
  );
}

/**
 * Parse test links from a comment body
 */
export function parseTestLinksFromComment(body: string): TestLink[] {
  const markerStart = body.indexOf(TEST_LINK_COMMENT_MARKER);
  if (markerStart === -1) return [];

  const markerEnd = body.indexOf(TEST_LINK_COMMENT_END, markerStart);
  if (markerEnd === -1) return [];

  const data = body.slice(
    markerStart + TEST_LINK_COMMENT_MARKER.length,
    markerEnd
  );

  if (!data.trim()) return [];

  try {
    return JSON.parse(data);
  } catch {
    // Legacy format: comma-separated file:identifier
    return data.split(",").map((entry) => {
      const [file, ...rest] = entry.trim().split(":");
      return {
        file,
        identifier: rest.join(":"),
        linkedAt: new Date().toISOString(),
      };
    });
  }
}

/**
 * Generate comment body with test links
 */
export function generateTestLinkComment(tests: TestLink[]): string {
  if (tests.length === 0) return "";

  const humanReadable = tests
    .map((t) => `- \`${t.file}:${t.identifier}\``)
    .join("\n");

  const machineReadable = `${TEST_LINK_COMMENT_MARKER}${JSON.stringify(tests)}${TEST_LINK_COMMENT_END}`;

  return `**Test Coverage**\n${humanReadable}\n\n${machineReadable}`;
}

/**
 * Find test link comment for an issue
 */
export async function findTestLinkComment(
  apiKey: string,
  issueId: string
): Promise<{ commentId: string; tests: TestLink[] } | null> {
  const comments = await getIssueComments(apiKey, issueId);

  for (const comment of comments) {
    if (comment.body.includes(TEST_LINK_COMMENT_MARKER)) {
      return {
        commentId: comment.id,
        tests: parseTestLinksFromComment(comment.body),
      };
    }
  }

  return null;
}

/**
 * Get all test links for multiple issues (batch fetch)
 */
export async function getAllTestLinks(
  apiKey: string,
  issues: LinearIssue[]
): Promise<IssueTestLinks[]> {
  const results: IssueTestLinks[] = [];

  // Fetch comments for all issues
  // Note: Could optimize with batched queries if needed
  for (const issue of issues) {
    const found = await findTestLinkComment(apiKey, issue.id);
    if (found) {
      results.push({
        issueId: issue.id,
        identifier: issue.identifier,
        tests: found.tests,
        commentId: found.commentId,
      });
    }
  }

  return results;
}
