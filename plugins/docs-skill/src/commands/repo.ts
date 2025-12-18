/**
 * repo command - Manage documentation repositories
 */

import type { RepoArgs } from "../lib/types";
import {
  addRepository,
  removeRepository,
  listRepositories,
  getRepositoriesPath,
} from "../lib/repo-store";

export async function repo(args: RepoArgs): Promise<void> {
  const { subcommand, path, docsPath } = args;

  switch (subcommand) {
    case "add": {
      if (!path) {
        console.error("Error: path is required");
        console.log("Usage: docs repo add <path>");
        process.exit(1);
      }

      const result = await addRepository(path, docsPath);
      if (!result.success) {
        console.error(`Error: ${result.error}`);
        process.exit(1);
      }

      console.log(`Added repository: ${result.repository!.id}`);
      console.log(`  Type: ${result.repository!.type}`);
      console.log(`  Path: ${result.repository!.path}`);
      if (result.repository!.docsPath) {
        console.log(`  Docs path: ${result.repository!.docsPath}`);
      }
      break;
    }

    case "list": {
      const repos = await listRepositories();

      if (repos.length === 0) {
        console.log("No repositories registered.");
        console.log();
        console.log("Add a repository with: docs repo add <path>");
        return;
      }

      console.log(`Registered repositories (${repos.length}):\n`);
      for (const r of repos) {
        console.log(`  ${r.id}`);
        console.log(`    Type: ${r.type}`);
        console.log(`    Path: ${r.path}`);
        if (r.docsPath) {
          console.log(`    Docs path: ${r.docsPath}`);
        }
        console.log(`    Added: ${r.addedAt}`);
        console.log();
      }

      console.log(`Config: ${getRepositoriesPath()}`);
      break;
    }

    case "remove": {
      if (!path) {
        console.error("Error: path is required");
        console.log("Usage: docs repo remove <path>");
        process.exit(1);
      }

      const result = await removeRepository(path);
      if (!result.success) {
        console.error(`Error: ${result.error}`);
        process.exit(1);
      }

      console.log(`Removed repository.`);
      break;
    }

    default:
      console.error(`Unknown repo subcommand: ${subcommand}`);
      process.exit(1);
  }
}
