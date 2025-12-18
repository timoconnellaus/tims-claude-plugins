/**
 * list command - Progressive disclosure for exploring synced docs
 */

import type { ParsedDoc } from "../lib/types";
import { loadUserDocs, docsDirExists } from "../lib/store";
import {
  buildDocTree,
  getNodeAtPath,
  getTopLevelCategories,
  getNodeContents,
} from "../lib/doc-tree";

export interface ListArgs {
  cwd: string;
  path?: string;
}

export async function list(args: ListArgs): Promise<void> {
  const { cwd, path } = args;

  // Check if .docs exists
  if (!(await docsDirExists(cwd))) {
    console.error("No .docs/ folder found.");
    console.log("Run 'docs init' and 'docs pull' first to sync documentation.");
    process.exit(1);
  }

  // Load synced docs
  const docs = await loadUserDocs(cwd);

  if (docs.length === 0) {
    console.log("No documentation synced yet.");
    console.log();
    console.log("Run 'docs pull' to sync documentation to .docs/");
    return;
  }

  // Build tree
  const tree = buildDocTree(docs);

  // No path - show top-level categories
  if (!path) {
    const categories = getTopLevelCategories(tree);

    console.log("Synced documentation:\n");

    for (const cat of categories) {
      const countStr = `(${cat.docCount} doc${cat.docCount !== 1 ? "s" : ""})`;
      console.log(`  ${cat.name}/`.padEnd(35) + countStr);
    }

    console.log();
    console.log("Use 'docs list <category>' to explore further.");
    console.log("Use 'docs show <topic>' to view a specific doc.");
    return;
  }

  // Navigate to the requested path
  const normalizedPath = path.replace(/\/$/, ""); // Remove trailing slash
  const node = getNodeAtPath(tree, normalizedPath);

  if (!node) {
    console.error(`Path not found: ${path}`);
    console.log();
    console.log("Use 'docs list' to see available categories.");
    process.exit(1);
  }

  // If it's a doc, redirect to show behavior
  if (node.isDoc && node.doc) {
    console.log(`"${path}" is a document. Use 'docs show ${path}' to view it.`);
    console.log();
    printDocSummary(node.doc);
    return;
  }

  // Show contents at this level
  const { directories, docs: nodeDocs } = getNodeContents(node);

  console.log(`${normalizedPath}/\n`);

  // Show subdirectories first
  for (const dir of directories) {
    const countStr = `(${dir.docCount} doc${dir.docCount !== 1 ? "s" : ""})`;
    console.log(`  ${dir.name}/`.padEnd(35) + countStr);
  }

  // Show docs with their titles and descriptions
  for (const { name, doc } of nodeDocs) {
    console.log(`  ${name}`);
    console.log(`    ${doc.frontmatter.title}`);
    if (doc.frontmatter.description) {
      const desc = doc.frontmatter.description;
      const truncated = desc.length > 70 ? desc.slice(0, 67) + "..." : desc;
      console.log(`    ${truncated}`);
    }
  }

  if (directories.length === 0 && nodeDocs.length === 0) {
    console.log("  (empty)");
  }

  console.log();

  // Show navigation hints
  if (directories.length > 0) {
    console.log(`Use 'docs list ${normalizedPath}/<name>' to explore further.`);
  }
  if (nodeDocs.length > 0) {
    console.log(`Use 'docs show ${normalizedPath}/<name>' to view a doc.`);
  }
}

function printDocSummary(doc: ParsedDoc): void {
  console.log(`Topic: ${doc.frontmatter.topic}`);
  console.log(`Title: ${doc.frontmatter.title}`);
  if (doc.frontmatter.description) {
    console.log(`Description: ${doc.frontmatter.description}`);
  }
  if (doc.frontmatter.tags && doc.frontmatter.tags.length > 0) {
    console.log(`Tags: ${doc.frontmatter.tags.join(", ")}`);
  }
}
