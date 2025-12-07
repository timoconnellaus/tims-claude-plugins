import {
  loadRequirements,
  saveRequirements,
  loadArchive,
  saveArchive,
  createHistoryEntry,
  requirementsFileExists,
} from "../lib/store";

const ARCHIVE_HELP = `
Archive a requirement (move to requirements.archive.json).

USAGE:
  bun req archive <id> [options]

OPTIONS:
  --reason <reason>  Reason for archiving
  --by <name>        Who is archiving this requirement
  --help, -h         Show this help message

EXAMPLES:
  bun req archive REQ-001 --reason "Feature deprecated"
`.trim();

const RESTORE_HELP = `
Restore an archived requirement.

USAGE:
  bun req restore <id>

OPTIONS:
  --help, -h  Show this help message

EXAMPLES:
  bun req restore REQ-001
`.trim();

export async function archive(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(ARCHIVE_HELP);
    return;
  }

  if (!requirementsFileExists()) {
    throw new Error("requirements.json not found. Run 'bun req init' first.");
  }

  let id: string | undefined;
  let reason: string | undefined;
  let by: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--reason" && args[i + 1]) {
      reason = args[i + 1];
      i++;
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

  const data = loadRequirements();
  const archive = loadArchive();

  if (!data.requirements[id]) {
    throw new Error(`Requirement ${id} not found`);
  }

  const req = data.requirements[id];
  req.history.push(createHistoryEntry("archived", reason, by));

  archive.requirements[id] = req;
  delete data.requirements[id];

  saveRequirements(data);
  saveArchive(archive);

  console.log(`Archived ${id}${reason ? `: ${reason}` : ""}`);
}

export async function restore(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(RESTORE_HELP);
    return;
  }

  if (!requirementsFileExists()) {
    throw new Error("requirements.json not found. Run 'bun req init' first.");
  }

  const id = args.find((a) => !a.startsWith("--"));

  if (!id) {
    throw new Error("Requirement ID is required");
  }

  const data = loadRequirements();
  const archive = loadArchive();

  if (!archive.requirements[id]) {
    throw new Error(`Requirement ${id} not found in archive`);
  }

  if (data.requirements[id]) {
    throw new Error(`Requirement ${id} already exists in active requirements`);
  }

  const req = archive.requirements[id];
  req.history.push(createHistoryEntry("restored"));

  data.requirements[id] = req;
  delete archive.requirements[id];

  saveRequirements(data);
  saveArchive(archive);

  console.log(`Restored ${id}`);
}
