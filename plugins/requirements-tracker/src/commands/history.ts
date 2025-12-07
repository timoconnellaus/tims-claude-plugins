import { loadRequirements, loadArchive, requirementsFileExists } from "../lib/store";
import type { HistoryEntry } from "../lib/types";

const HELP = `
Show the history of a requirement.

USAGE:
  bun req history <id>

OPTIONS:
  --json      Output as JSON
  --help, -h  Show this help message

EXAMPLES:
  bun req history REQ-001
  bun req history REQ-001 --json
`.trim();

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString();
}

function formatEntry(entry: HistoryEntry): string {
  const parts = [`  ${formatDate(entry.timestamp)} - ${entry.action}`];
  if (entry.by) parts.push(`by ${entry.by}`);
  if (entry.note) parts.push(`- ${entry.note}`);
  return parts.join(" ");
}

export async function history(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    return;
  }

  if (!requirementsFileExists()) {
    throw new Error("requirements.json not found. Run 'bun req init' first.");
  }

  const json = args.includes("--json");
  const id = args.find((a) => !a.startsWith("--"));

  if (!id) {
    throw new Error("Requirement ID is required");
  }

  // Check both active and archive
  const data = loadRequirements();
  const archive = loadArchive();

  const req = data.requirements[id] ?? archive.requirements[id];
  const isArchived = !data.requirements[id] && !!archive.requirements[id];

  if (!req) {
    throw new Error(`Requirement ${id} not found`);
  }

  if (json) {
    console.log(JSON.stringify({
      id,
      description: req.description,
      archived: isArchived,
      history: req.history,
    }, null, 2));
    return;
  }

  console.log(`History for ${id}${isArchived ? " (archived)" : ""}:`);
  console.log(`  "${req.description}"`);
  console.log("");

  for (const entry of req.history) {
    console.log(formatEntry(entry));
  }
}
