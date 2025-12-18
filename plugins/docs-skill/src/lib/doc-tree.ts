/**
 * Doc tree utilities for hierarchical navigation of documentation
 */

import type { ParsedDoc } from "./types";

/**
 * Node in the doc tree - can be a directory (has children) or a doc (has doc)
 */
export interface DocTreeNode {
  /** Name of this node (segment of the path) */
  name: string;
  /** Whether this node represents a doc (leaf) */
  isDoc: boolean;
  /** The doc if this is a leaf node */
  doc?: ParsedDoc;
  /** Child nodes (subdirectories or docs) */
  children: Map<string, DocTreeNode>;
  /** Total number of docs in this subtree */
  docCount: number;
}

/**
 * Build a hierarchical tree from a flat list of docs
 * Topics like "tanstack-db/api/overview" become nested nodes
 */
export function buildDocTree(docs: ParsedDoc[]): DocTreeNode {
  const root: DocTreeNode = {
    name: "",
    isDoc: false,
    children: new Map(),
    docCount: 0,
  };

  for (const doc of docs) {
    const segments = doc.frontmatter.topic.split("/");
    let current = root;

    // Navigate/create path to parent
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      if (!current.children.has(segment)) {
        current.children.set(segment, {
          name: segment,
          isDoc: false,
          children: new Map(),
          docCount: 0,
        });
      }
      current = current.children.get(segment)!;
    }

    // Add the doc at the leaf
    const leafName = segments[segments.length - 1];
    current.children.set(leafName, {
      name: leafName,
      isDoc: true,
      doc,
      children: new Map(),
      docCount: 1,
    });
  }

  // Update doc counts up the tree
  updateDocCounts(root);

  return root;
}

/**
 * Recursively update docCount for all nodes
 */
function updateDocCounts(node: DocTreeNode): number {
  if (node.isDoc) {
    return 1;
  }

  let count = 0;
  for (const child of node.children.values()) {
    count += updateDocCounts(child);
  }
  node.docCount = count;
  return count;
}

/**
 * Get a node at a specific path
 * Returns null if path doesn't exist
 */
export function getNodeAtPath(tree: DocTreeNode, path: string): DocTreeNode | null {
  if (!path || path === "") {
    return tree;
  }

  const segments = path.split("/").filter(Boolean);
  let current = tree;

  for (const segment of segments) {
    const child = current.children.get(segment);
    if (!child) {
      return null;
    }
    current = child;
  }

  return current;
}

/**
 * Get all top-level categories with their doc counts
 */
export function getTopLevelCategories(tree: DocTreeNode): Array<{ name: string; docCount: number }> {
  const categories: Array<{ name: string; docCount: number }> = [];

  for (const [name, node] of tree.children) {
    categories.push({ name, docCount: node.docCount });
  }

  return categories.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get contents of a node (both subdirectories and docs)
 */
export function getNodeContents(node: DocTreeNode): {
  directories: Array<{ name: string; docCount: number }>;
  docs: Array<{ name: string; doc: ParsedDoc }>;
} {
  const directories: Array<{ name: string; docCount: number }> = [];
  const docs: Array<{ name: string; doc: ParsedDoc }> = [];

  for (const [name, child] of node.children) {
    if (child.isDoc && child.doc) {
      docs.push({ name, doc: child.doc });
    } else {
      directories.push({ name, docCount: child.docCount });
    }
  }

  // Sort alphabetically
  directories.sort((a, b) => a.name.localeCompare(b.name));
  docs.sort((a, b) => a.name.localeCompare(b.name));

  return { directories, docs };
}

/**
 * Find docs with topics similar to the query (for suggestions)
 */
export function findSimilarTopics(
  docs: ParsedDoc[],
  query: string,
  limit: number = 5
): ParsedDoc[] {
  const lowerQuery = query.toLowerCase();
  const querySegments = lowerQuery.split("/");

  // Score each doc by similarity
  const scored = docs.map((doc) => {
    const topic = doc.frontmatter.topic.toLowerCase();
    const topicSegments = topic.split("/");
    let score = 0;

    // Exact segment matches
    for (const segment of querySegments) {
      if (topicSegments.includes(segment)) {
        score += 10;
      }
    }

    // Partial matches in topic
    if (topic.includes(lowerQuery)) {
      score += 20;
    }

    // Partial matches in individual segments
    for (const qSeg of querySegments) {
      for (const tSeg of topicSegments) {
        if (tSeg.includes(qSeg) || qSeg.includes(tSeg)) {
          score += 5;
        }
      }
    }

    // Title match
    if (doc.frontmatter.title.toLowerCase().includes(lowerQuery)) {
      score += 15;
    }

    return { doc, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.doc);
}
