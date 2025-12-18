import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import {
  loadRepositories,
  loadDocsFromRepo,
} from "../../../../lib/repo-store";
import type { ParsedDoc } from "../../../../lib/types";

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
        // Update existing folder to also be a doc
        existing.doc = doc;
      }

      currentLevel = existing.children;
    }
  }

  // Post-process: ensure any node with children is marked as a folder
  function fixFolderFlags(nodes: DocTreeNode[]) {
    for (const node of nodes) {
      if (node.children.length > 0) {
        node.isFolder = true;
      }
      fixFolderFlags(node.children);
    }
  }
  fixFolderFlags(root);

  return root;
}

export const Route = createFileRoute("/api/repositories/$id/docs")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const id = decodeURIComponent(params.id);
          const repos = await loadRepositories();
          const repo = repos.repositories.find((r) => r.id === id);

          if (!repo) {
            return json({ error: "Repository not found" }, { status: 404 });
          }

          const docs = await loadDocsFromRepo(repo);
          const tree = buildDocTree(docs);

          return json({ docs, tree });
        } catch (error) {
          return json(
            { error: (error as Error).message },
            { status: 500 }
          );
        }
      },
    },
  },
});
