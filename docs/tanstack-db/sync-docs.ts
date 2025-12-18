/**
 * TanStack DB documentation sync script
 */

import { createGitHubDocsContract } from "../_shared/github-docs-sync";

export default createGitHubDocsContract({
  repo: "tanstack/db",
  name: "TanStack DB",
  topicPrefix: "tanstack-db",
  docsPath: "docs",
  version: "beta",
  skipDirs: ["reference"], // Include framework docs
});
