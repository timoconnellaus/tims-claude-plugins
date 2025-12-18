import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { loadAllRepoDocs } from "../../../../lib/repo-store";
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
        // Update existing folder to be a doc
        existing.doc = doc;
        existing.isFolder = false;
      }

      currentLevel = existing.children;
    }
  }

  return root;
}

export const Route = createFileRoute("/api/all-docs")({
  server: {
    handlers: {
      GET: async () => {
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

          return json(result);
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
