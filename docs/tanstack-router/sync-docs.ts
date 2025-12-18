/**
 * TanStack Router documentation sync script
 */

import { createGitHubDocsContract } from "../_shared/github-docs-sync";

export default createGitHubDocsContract({
  repo: "tanstack/router",
  name: "TanStack Router",
  topicPrefix: "tanstack-router",
  docsPath: "docs/router",
  skipDirs: [], // Include framework/react, framework/solid, api, etc.
});
