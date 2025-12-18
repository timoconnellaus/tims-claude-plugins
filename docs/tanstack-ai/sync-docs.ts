/**
 * TanStack AI documentation sync script
 */

import { createGitHubDocsContract } from "../_shared/github-docs-sync";

export default createGitHubDocsContract({
  repo: "tanstack/ai",
  name: "TanStack AI",
  topicPrefix: "tanstack-ai",
  docsPath: "docs",
  skipDirs: ["reference"], // Include api and other docs
});
