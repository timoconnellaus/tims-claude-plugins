/**
 * TanStack Start documentation sync script
 */

import { createGitHubDocsContract } from "../_shared/github-docs-sync";

export default createGitHubDocsContract({
  repo: "tanstack/router",
  name: "TanStack Start",
  topicPrefix: "tanstack-start",
  docsPath: "docs/start",
  skipDirs: [], // Include all docs
});
