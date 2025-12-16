/**
 * Open documentation in browser
 */

import { startServer } from "../ui/server";
import { requirementsDirExists } from "../lib/store";

export async function docs(args: { cwd: string; port: number }) {
  const { cwd, port } = args;

  // Check if initialized
  if (!(await requirementsDirExists(cwd))) {
    console.error("Not initialized. Run 'req init' first.");
    process.exit(1);
  }

  // Start the server
  await startServer({ cwd, port });

  // Open browser directly to docs page
  const url = `http://localhost:${port}#docs`;
  try {
    if (process.platform === "darwin") {
      Bun.spawn(["open", url]);
    } else if (process.platform === "linux") {
      Bun.spawn(["xdg-open", url]);
    } else if (process.platform === "win32") {
      Bun.spawn(["cmd", "/c", "start", url]);
    }
  } catch {
    // Ignore errors opening browser
  }

  console.log(`Documentation available at ${url}`);

  // Keep running until Ctrl+C
  await new Promise(() => {});
}
