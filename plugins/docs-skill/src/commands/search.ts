/**
 * search command - Search available documentation
 */

import type { SearchArgs, DocSearchResult } from "../lib/types";
import { loadAllDocs } from "../lib/store";
import { loadAllRepoDocs } from "../lib/repo-store";

export async function search(args: SearchArgs): Promise<void> {
  const { query } = args;
  const lowerQuery = query.toLowerCase();

  // Load all docs from the plugin
  const allDocs = await loadAllDocs();

  // Also load docs from registered repositories
  const repoDocs = await loadAllRepoDocs();
  for (const [repoId, docs] of repoDocs) {
    allDocs.set(`repo:${repoId}`, docs);
  }

  // Search through docs
  const results: DocSearchResult[] = [];

  for (const [source, docs] of allDocs) {
    for (const doc of docs) {
      const matchesTopic = doc.frontmatter.topic.toLowerCase().includes(lowerQuery);
      const matchesTitle = doc.frontmatter.title.toLowerCase().includes(lowerQuery);
      const matchesDesc =
        doc.frontmatter.description?.toLowerCase().includes(lowerQuery) ?? false;
      const matchesTags =
        doc.frontmatter.tags?.some((tag) =>
          tag.toLowerCase().includes(lowerQuery)
        ) ?? false;

      if (matchesTopic || matchesTitle || matchesDesc || matchesTags) {
        results.push({
          topic: doc.frontmatter.topic,
          title: doc.frontmatter.title,
          description: doc.frontmatter.description,
          source,
          path: doc.path,
        });
      }
    }
  }

  if (results.length === 0) {
    console.log(`No docs found matching "${query}"`);
    console.log();
    console.log("Try a different search term or run 'docs search' with a broader query.");
    return;
  }

  console.log(`Found ${results.length} result(s) for "${query}":\n`);

  // Group by source
  const bySource = new Map<string, DocSearchResult[]>();
  for (const result of results) {
    const existing = bySource.get(result.source) ?? [];
    existing.push(result);
    bySource.set(result.source, existing);
  }

  for (const [source, sourceResults] of bySource) {
    console.log(`${source}/`);
    for (const result of sourceResults) {
      console.log(`  ${result.topic}`);
      console.log(`    ${result.title}`);
      if (result.description) {
        console.log(`    ${result.description.slice(0, 80)}${result.description.length > 80 ? "..." : ""}`);
      }
    }
    console.log();
  }

  console.log("To add docs to your project:");
  console.log(`  docs config --add "${results[0].topic.split("/")[0]}/**"`);
}
