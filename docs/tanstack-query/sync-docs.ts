/**
 * TanStack Query documentation sync script
 */

import { createGitHubDocsContract } from "../_shared/github-docs-sync";

export default createGitHubDocsContract({
  repo: "tanstack/query",
  name: "TanStack Query",
  topicPrefix: "tanstack-query",
  docsPath: "docs",
  skipDirs: ["reference", "eslint"], // Include framework docs
});
