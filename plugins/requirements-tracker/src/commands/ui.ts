/**
 * Start web UI for viewing requirements
 */

import { startServer } from "../ui/server";
import { requirementsDirExists } from "../lib/store";

export async function ui(args: { cwd: string; port: number }) {
  const { cwd, port } = args;

  // Check if initialized
  if (!(await requirementsDirExists(cwd))) {
    console.error("Not initialized. Run 'req init' first.");
    process.exit(1);
  }

  // Start the server
  const server = await startServer({ cwd, port });

  // Try to open browser (non-blocking)
  const url = `http://localhost:${port}`;
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

  // Keep running until Ctrl+C
  await new Promise(() => {});
}
