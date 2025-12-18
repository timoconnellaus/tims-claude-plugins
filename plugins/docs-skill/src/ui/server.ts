/**
 * Bun web server for docs-skill UI
 */

import { watch } from "fs";
import { join } from "path";
import { homedir } from "os";

import homepage from "./index.html";

import {
  loadRepositories,
  addRepository,
  removeRepository,
  loadDocsFromRepo,
  loadAllRepoDocs,
  getGlobalConfigDir,
  getRepositoriesPath,
} from "../lib/repo-store";
import {
  loadConfig,
  saveConfig,
  loadUserDocs,
  docsDirExists,
  getDocsDir,
  getConfigPath,
  createDefaultConfig,
} from "../lib/store";
import { getIncludedTopics } from "../lib/topic-matcher";
import type { Repository, ParsedDoc, UserConfig } from "../lib/types";

// SSE clients for live reload
const clients = new Set<ReadableStreamDefaultController>();

function broadcastRefresh() {
  for (const controller of clients) {
    try {
      controller.enqueue(`data: refresh\n\n`);
    } catch {
      clients.delete(controller);
    }
  }
}

// Build a tree structure from docs for display
interface DocTreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children: DocTreeNode[];
  doc?: ParsedDoc;
}

function buildDocTree(docs: ParsedDoc[]): DocTreeNode[] {
  const root: DocTreeNode[] = [];

  // Sort docs by topic for consistent ordering
  const sortedDocs = [...docs].sort((a, b) =>
    a.frontmatter.topic.localeCompare(b.frontmatter.topic)
  );

  for (const doc of sortedDocs) {
    const parts = doc.frontmatter.topic.split("/");
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join("/");

      let existing = currentLevel.find((n) => n.name === part);

      if (!existing) {
        existing = {
          name: part,
          path: currentPath,
          isFolder: !isLast,
          children: [],
          doc: isLast ? doc : undefined,
        };
        currentLevel.push(existing);
      } else if (isLast) {
        // Update existing folder to be a doc
        existing.doc = doc;
        existing.isFolder = false;
      }

      currentLevel = existing.children;
    }
  }

  return root;
}

export async function startServer(args: { cwd: string; port: number }) {
  const { cwd, port } = args;

  // Watch for file changes
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Watch global repositories file
  const globalConfigDir = getGlobalConfigDir();
  try {
    watch(globalConfigDir, { recursive: false }, (event, filename) => {
      if (filename === "repositories.yml") {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          broadcastRefresh();
        }, 100);
      }
    });
  } catch {
    console.warn("Warning: Could not watch global config directory");
  }

  // Watch project .docs directory
  const docsDir = getDocsDir(cwd);
  try {
    if (await docsDirExists(cwd)) {
      watch(docsDir, { recursive: true }, () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          broadcastRefresh();
        }, 100);
      });
    }
  } catch {
    console.warn("Warning: Could not watch .docs directory");
  }

  const server = Bun.serve({
    port,
    development: true,
    idleTimeout: 0,
    routes: {
      "/": homepage,

      "/api/events": {
        GET() {
          const stream = new ReadableStream({
            start(controller) {
              clients.add(controller);
              controller.enqueue(`data: connected\n\n`);
            },
            cancel() {
              // Client disconnected - will be cleaned up on next broadcast
            },
          });
          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });
        },
      },

      // Global repositories
      "/api/repositories": {
        async GET() {
          const repos = await loadRepositories();
          return Response.json(repos.repositories);
        },
        async POST(req) {
          try {
            const body = (await req.json()) as {
              path: string;
              docsPath?: string;
            };

            if (!body.path) {
              return Response.json(
                { success: false, error: "Path is required" },
                { status: 400 }
              );
            }

            const result = await addRepository(body.path, body.docsPath);

            if (!result.success) {
              return Response.json(
                { success: false, error: result.error },
                { status: 400 }
              );
            }

            broadcastRefresh();
            return Response.json({ success: true, repository: result.repository });
          } catch (error) {
            return Response.json(
              { success: false, error: (error as Error).message },
              { status: 500 }
            );
          }
        },
      },

      // Project config
      "/api/config": {
        async GET() {
          const config = await loadConfig(cwd);
          return Response.json(config || createDefaultConfig());
        },
        async PUT(req) {
          try {
            const body = (await req.json()) as { topics: string[] };

            if (!Array.isArray(body.topics)) {
              return Response.json(
                { success: false, error: "Topics must be an array" },
                { status: 400 }
              );
            }

            const existingConfig = await loadConfig(cwd);
            const config: UserConfig = {
              version: 1,
              topics: body.topics,
              lastSync: existingConfig?.lastSync,
              source: existingConfig?.source,
            };

            await saveConfig(cwd, config);
            broadcastRefresh();

            return Response.json({ success: true, config });
          } catch (error) {
            return Response.json(
              { success: false, error: (error as Error).message },
              { status: 500 }
            );
          }
        },
      },

      // Synced docs in project
      "/api/synced-docs": {
        async GET() {
          try {
            const docs = await loadUserDocs(cwd);
            return Response.json(docs);
          } catch {
            return Response.json([]);
          }
        },
      },

      // Pull docs to project
      "/api/pull": {
        async POST() {
          try {
            // Import pull command dynamically to avoid circular deps
            const { pull } = await import("../commands/pull");
            await pull({ cwd, force: true });
            broadcastRefresh();
            return Response.json({ success: true });
          } catch (error) {
            return Response.json(
              { success: false, error: (error as Error).message },
              { status: 500 }
            );
          }
        },
      },
    },

    async fetch(req) {
      const url = new URL(req.url);

      // Handle DELETE /api/repositories/:id
      if (
        req.method === "DELETE" &&
        url.pathname.startsWith("/api/repositories/")
      ) {
        const id = decodeURIComponent(url.pathname.slice("/api/repositories/".length));

        try {
          const result = await removeRepository(id);

          if (!result.success) {
            return Response.json(
              { success: false, error: result.error },
              { status: 404 }
            );
          }

          broadcastRefresh();
          return Response.json({ success: true });
        } catch (error) {
          return Response.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
          );
        }
      }

      // Handle GET /api/repositories/:id/docs
      if (
        req.method === "GET" &&
        url.pathname.match(/^\/api\/repositories\/[^/]+\/docs$/)
      ) {
        const id = decodeURIComponent(
          url.pathname.slice("/api/repositories/".length, -"/docs".length)
        );

        try {
          const repos = await loadRepositories();
          const repo = repos.repositories.find((r) => r.id === id);

          if (!repo) {
            return Response.json(
              { error: "Repository not found" },
              { status: 404 }
            );
          }

          const docs = await loadDocsFromRepo(repo);
          const tree = buildDocTree(docs);

          return Response.json({ docs, tree });
        } catch (error) {
          return Response.json(
            { error: (error as Error).message },
            { status: 500 }
          );
        }
      }

      // Handle GET /api/all-docs (load docs from all repos)
      if (req.method === "GET" && url.pathname === "/api/all-docs") {
        try {
          const allDocs = await loadAllRepoDocs();
          const result: { repoId: string; docs: ParsedDoc[]; tree: DocTreeNode[] }[] = [];

          for (const [repoId, docs] of allDocs) {
            result.push({
              repoId,
              docs,
              tree: buildDocTree(docs),
            });
          }

          return Response.json(result);
        } catch (error) {
          return Response.json(
            { error: (error as Error).message },
            { status: 500 }
          );
        }
      }

      return new Response("Not found", { status: 404 });
    },
  });

  console.log(`Docs Skill UI running at http://localhost:${port}`);
  console.log("Press Ctrl+C to stop");

  return server;
}
