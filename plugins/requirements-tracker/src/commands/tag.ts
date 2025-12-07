import {
  loadRequirements,
  saveRequirements,
  createHistoryEntry,
  requirementsFileExists,
} from "../lib/store";

const HELP = `
Manage tags on a requirement.

USAGE:
  bun req tag <id> [options]

OPTIONS:
  --add <tag>     Add a tag (can be repeated)
  --remove <tag>  Remove a tag (can be repeated)
  --clear         Remove all tags
  --by <name>     Who is making this change
  --help, -h      Show this help message

EXAMPLES:
  bun req tag REQ-001 --add security --add auth
  bun req tag REQ-001 --remove deprecated
  bun req tag REQ-001 --clear
`.trim();

function parseArgs(args: string[]): {
  id: string;
  add: string[];
  remove: string[];
  clear: boolean;
  by?: string;
} {
  let id = "";
  const add: string[] = [];
  const remove: string[] = [];
  let clear = false;
  let by: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--add" && args[i + 1]) {
      add.push(args[i + 1]);
      i++;
    } else if (arg === "--remove" && args[i + 1]) {
      remove.push(args[i + 1]);
      i++;
    } else if (arg === "--clear") {
      clear = true;
    } else if (arg === "--by" && args[i + 1]) {
      by = args[i + 1];
      i++;
    } else if (!arg.startsWith("--")) {
      id = arg;
    }
  }

  if (!id) {
    throw new Error("Requirement ID is required");
  }

  if (add.length === 0 && remove.length === 0 && !clear) {
    throw new Error("At least one of --add, --remove, or --clear is required");
  }

  return { id, add, remove, clear, by };
}

export async function tag(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    return;
  }

  if (!requirementsFileExists()) {
    throw new Error("requirements.json not found. Run 'bun req init' first.");
  }

  const { id, add, remove, clear, by } = parseArgs(args);
  const data = loadRequirements();

  const requirement = data.requirements[id];
  if (!requirement) {
    throw new Error(`Requirement ${id} not found`);
  }

  const oldTags = requirement.tags ?? [];
  let newTags: string[];

  if (clear) {
    newTags = [];
  } else {
    newTags = [...oldTags];
    for (const t of add) {
      if (!newTags.includes(t)) {
        newTags.push(t);
      }
    }
    for (const t of remove) {
      const idx = newTags.indexOf(t);
      if (idx !== -1) {
        newTags.splice(idx, 1);
      }
    }
  }

  requirement.tags = newTags.length > 0 ? newTags : undefined;

  const changes: string[] = [];
  if (clear) {
    changes.push("cleared all tags");
  } else {
    if (add.length > 0) changes.push(`added: ${add.join(", ")}`);
    if (remove.length > 0) changes.push(`removed: ${remove.join(", ")}`);
  }

  requirement.history.push(
    createHistoryEntry("tags_changed", changes.join("; "), by)
  );

  saveRequirements(data);

  const tagDisplay = newTags.length > 0 ? `[${newTags.join(", ")}]` : "(none)";
  console.log(`${id} tags: ${tagDisplay}`);
}
