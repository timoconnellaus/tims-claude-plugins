/**
 * inject-claude command - Insert/update synced docs section in CLAUDE.md
 */

import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { loadUserDocs, docsDirExists } from "../lib/store";
import { buildDocTree, getTopLevelCategories } from "../lib/doc-tree";

export interface InjectClaudeArgs {
  cwd: string;
}

const SECTION_START = "<docs-skill-synced>";
const SECTION_END = "</docs-skill-synced>";

export async function injectClaude(args: InjectClaudeArgs): Promise<void> {
  const { cwd } = args;

  // Check if .docs exists
  if (!(await docsDirExists(cwd))) {
    console.error("No .docs/ folder found.");
    console.log("Run 'docs init' and 'docs pull' first to sync documentation.");
    process.exit(1);
  }

  // Load synced docs
  const docs = await loadUserDocs(cwd);

  // Generate the section content
  const sectionContent = generateSection(docs);

  // Read or create CLAUDE.md
  const claudePath = join(cwd, "CLAUDE.md");
  let existingContent = "";

  try {
    existingContent = await readFile(claudePath, "utf-8");
  } catch {
    // File doesn't exist, will create it
  }

  // Find and replace existing section, or append
  const newContent = injectSection(existingContent, sectionContent);

  // Write the file
  await writeFile(claudePath, newContent);

  // Output summary
  if (docs.length === 0) {
    console.log("Injected docs section into CLAUDE.md (no docs synced yet).");
  } else {
    const tree = buildDocTree(docs);
    const categories = getTopLevelCategories(tree);
    console.log(`Injected docs section into CLAUDE.md with ${categories.length} categor${categories.length === 1 ? "y" : "ies"}:`);
    for (const cat of categories) {
      console.log(`  - ${cat.name} (${cat.docCount} docs)`);
    }
  }

  console.log();
  console.log("The section is wrapped in <docs-skill-synced> tags for future updates.");
}

function generateSection(docs: ParsedDoc[]): string {
  const lines: string[] = [];

  lines.push(SECTION_START);
  lines.push("## Synced Documentation");
  lines.push("");

  if (docs.length === 0) {
    lines.push("No documentation synced yet. Run `docs pull` to sync documentation.");
  } else {
    const tree = buildDocTree(docs);
    const categories = getTopLevelCategories(tree);

    lines.push("The following documentation is available in `.docs/`:");
    lines.push("");

    for (const cat of categories) {
      lines.push(`- **${cat.name}** (${cat.docCount} doc${cat.docCount !== 1 ? "s" : ""})`);
    }

    lines.push("");
    lines.push("To explore:");
    lines.push("- `docs list` - Show documentation categories");
    lines.push("- `docs list <category>` - Drill into a category");
    lines.push("- `docs show <topic>` - Show full doc content");
  }

  lines.push(SECTION_END);

  return lines.join("\n");
}

function injectSection(existingContent: string, newSection: string): string {
  // Look for existing section
  const startIdx = existingContent.indexOf(SECTION_START);
  const endIdx = existingContent.indexOf(SECTION_END);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    // Replace existing section
    const before = existingContent.slice(0, startIdx);
    const after = existingContent.slice(endIdx + SECTION_END.length);

    return before + newSection + after;
  }

  // No existing section - append to end
  if (existingContent.length === 0) {
    return newSection + "\n";
  }

  // Add newlines before appending if needed
  const separator = existingContent.endsWith("\n\n")
    ? ""
    : existingContent.endsWith("\n")
      ? "\n"
      : "\n\n";

  return existingContent + separator + newSection + "\n";
}

// Import for type only
import type { ParsedDoc } from "../lib/types";
