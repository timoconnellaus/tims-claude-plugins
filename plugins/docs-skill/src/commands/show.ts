/**
 * show command - Display full content of a specific doc
 */

import type { ParsedDoc } from "../lib/types";
import { loadUserDocs, docsDirExists } from "../lib/store";
import { findSimilarTopics } from "../lib/doc-tree";

export interface ShowArgs {
  cwd: string;
  topic: string;
}

export async function show(args: ShowArgs): Promise<void> {
  const { cwd, topic } = args;

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

  // Find the doc by exact topic match
  const normalizedTopic = topic.replace(/\/$/, ""); // Remove trailing slash
  const doc = docs.find((d) => d.frontmatter.topic === normalizedTopic);

  if (!doc) {
    console.error(`Topic not found: ${topic}`);
    console.log();

    // Find similar topics for suggestions
    const similar = findSimilarTopics(docs, normalizedTopic);

    if (similar.length > 0) {
      console.log("Did you mean:");
      for (const s of similar) {
        console.log(`  ${s.frontmatter.topic}`);
        console.log(`    ${s.frontmatter.title}`);
      }
      console.log();
    }

    // Suggest listing the parent path
    const parentPath = normalizedTopic.split("/").slice(0, -1).join("/");
    if (parentPath) {
      console.log(`Use 'docs list ${parentPath}' to see available topics.`);
    } else {
      console.log("Use 'docs list' to see available categories.");
    }

    process.exit(1);
  }

  // Display the doc
  printDoc(doc);
}

function printDoc(doc: ParsedDoc): void {
  // Print title as heading
  console.log(`# ${doc.frontmatter.title}`);
  console.log();

  // Print metadata
  console.log(`Topic: ${doc.frontmatter.topic}`);

  if (doc.frontmatter.sourceUrl) {
    console.log(`Source: ${doc.frontmatter.sourceUrl}`);
  }

  if (doc.frontmatter.version) {
    console.log(`Version: ${doc.frontmatter.version}`);
  }

  if (doc.frontmatter.tags && doc.frontmatter.tags.length > 0) {
    console.log(`Tags: ${doc.frontmatter.tags.join(", ")}`);
  }

  if (doc.frontmatter.description) {
    console.log();
    console.log(doc.frontmatter.description);
  }

  console.log();
  console.log("---");
  console.log();

  // Print content
  console.log(doc.content);
}
