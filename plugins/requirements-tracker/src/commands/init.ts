/**
 * Initialize requirements tracking (local or Linear mode)
 */

import { createInterface } from "readline";
import {
  configExists,
  saveConfig,
  saveCache,
} from "../lib/store";
import { verifyApiKey, getTeams, getProjects } from "../lib/linear";
import type { RequirementsConfig, RequirementsMode, LocalCache } from "../lib/types";

function prompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function select(
  question: string,
  options: Array<{ value: string; label: string }>
): Promise<string> {
  console.log(question);
  options.forEach((opt, i) => {
    console.log(`  ${i + 1}. ${opt.label}`);
  });

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const ask = () => {
      rl.question("Select (number): ", (answer) => {
        const num = parseInt(answer.trim(), 10);
        if (num >= 1 && num <= options.length) {
          rl.close();
          resolve(options[num - 1].value);
        } else {
          console.log("Invalid selection, try again.");
          ask();
        }
      });
    };
    ask();
  });
}

export async function init(args: {
  cwd: string;
  force?: boolean;
}): Promise<void> {
  const { cwd, force } = args;

  // Check for existing config
  if (await configExists(cwd)) {
    if (!force) {
      console.log("Requirements already initialized.");
      console.log("Use --force to reconfigure.");
      return;
    }
    console.log("Reconfiguring...\n");
  }

  // Ask which mode
  const mode = await select("How do you want to track requirements?", [
    { value: "local", label: "Local only (JSON file, no external service)" },
    { value: "linear", label: "Linear integration (sync with Linear issues)" },
  ]) as RequirementsMode;

  if (mode === "local") {
    await initLocal(cwd);
  } else {
    await initLinear(cwd);
  }
}

async function initLocal(cwd: string): Promise<void> {
  // Get prefix
  const prefixInput = await prompt("Issue prefix (default: REQ): ");
  const prefix = (prefixInput || "REQ").toUpperCase();

  // Create config
  const config: RequirementsConfig = {
    mode: "local",
    prefix,
    nextId: 1,
  };

  await saveConfig(cwd, config);

  // Create empty cache
  const cache: LocalCache = {
    mode: "local",
    lastSync: new Date().toISOString(),
    issues: [],
    testLinks: [],
  };
  await saveCache(cwd, cache);

  console.log("\nLocal mode initialized.");
  console.log("Configuration saved to .requirements.json");
  console.log(`Issues will use prefix: ${prefix}-001, ${prefix}-002, ...`);
  console.log("\nRun 'req add <title>' to create your first requirement.");
}

async function initLinear(cwd: string): Promise<void> {
  // Get API key
  let apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    console.log("\nLinear API key not found in environment.");
    console.log("You can set LINEAR_API_KEY environment variable or enter it now.");
    console.log("Get your API key at: https://linear.app/settings/api\n");
    apiKey = await prompt("Linear API key: ");

    if (!apiKey) {
      console.error("API key is required.");
      process.exit(1);
    }
  }

  // Verify API key
  console.log("\nVerifying API key...");
  const valid = await verifyApiKey(apiKey);
  if (!valid) {
    console.error("Invalid API key.");
    process.exit(1);
  }
  console.log("API key verified.\n");

  // Get teams
  const teams = await getTeams(apiKey);
  if (teams.length === 0) {
    console.error("No teams found. Make sure you have access to at least one team.");
    process.exit(1);
  }

  // Select team
  const teamId = await select(
    "Select a team:",
    teams.map((t) => ({ value: t.id, label: `${t.name} (${t.key})` }))
  );
  const team = teams.find((t) => t.id === teamId)!;

  // Optionally select project
  const projects = await getProjects(apiKey, teamId);
  let projectId: string | undefined;

  if (projects.length > 0) {
    const projectChoice = await select("Filter by project? (optional)", [
      { value: "", label: "No - sync all team issues" },
      ...projects.map((p) => ({ value: p.id, label: p.name })),
    ]);
    if (projectChoice) {
      projectId = projectChoice;
    }
  }

  // Ask about storing API key
  const storeKey = await prompt(
    "\nStore API key in config file? (y/N): "
  );

  // Create config
  const config: RequirementsConfig = {
    mode: "linear",
    teamId: team.id,
    teamKey: team.key,
  };

  if (projectId) {
    config.projectId = projectId;
  }

  if (storeKey.toLowerCase() === "y") {
    config.linearApiKey = apiKey;
    console.log("\nAPI key will be stored in .requirements.json");
    console.log("Consider adding .requirements.json to .gitignore");
  } else {
    console.log("\nAPI key not stored. Set LINEAR_API_KEY environment variable.");
  }

  // Save config
  await saveConfig(cwd, config);
  console.log("\nConfiguration saved to .requirements.json");
  console.log(`Team: ${team.name} (${team.key})`);
  if (projectId) {
    const project = projects.find((p) => p.id === projectId);
    console.log(`Project: ${project?.name}`);
  }
  console.log("\nRun 'req sync' to fetch issues from Linear.");
}
